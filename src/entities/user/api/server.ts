import { homeSettingsSchema } from "../model/home-settings.schema";
import "server-only";
import { profileSchema } from "../model/profile.schema";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  mockContext,
  mockJson,
  createServerSupabaseClient,
  throwDatabaseError as throwSharedDatabaseError,
} from "@/shared/server";
import type { Account } from "./type";
import { providers, type LoginProvider } from "../model/providers.constants";
import type { FamilyRole } from "@/entities/family/@x/user";
const databaseErrors = {
  unauthorized: [401, "로그인이 필요해요."],
  identity_policy_violation: [
    409,
    "다른 로그인 수단으로 시도하거나 서비스 운영자에게 문의해 주세요",
  ],
  consent_required: [400, "이용약관과 개인정보 처리방침에 모두 동의해 주세요."],
  display_name_required: [400, "표시 이름을 입력해 주세요."],
  display_name_too_long: [400, "표시 이름은 6자 이하로 입력해 주세요."],
} as const;
function throwDatabaseError(error: { message: string } | null) {
  throwSharedDatabaseError(error, databaseErrors);
}

function assertIdentityPolicy(user: User) {
  if (
    user.identities?.length !== 1 ||
    !z.enum(providers).safeParse(user.identities[0].provider).success ||
    (user.identities[0].provider === "kakao" && Boolean(user.email))
  ) {
    throw new ApiError(
      "identity_policy_violation",
      "다른 로그인 수단으로 시도하거나 서비스 운영자에게 문의해 주세요",
      409,
    );
  }
}
async function mockAccount(): Promise<Account | null> {
  const context = await mockContext();
  if (!context) return null;
  const family = await mockJson("family");
  const member = family.members[context.perspective]!;
  const stage = context.values.get("account-stage") ?? context.stage;
  if (stage === "login")
    return { userId: null, profile: null, membership: null };
  const displayName = context.values.get(`display-name:${member.user_id}`);
  return {
    loginProvider: "kakao",
    userId: member.user_id,
    profile:
      stage === "profile"
        ? null
        : {
            displayName:
              typeof displayName === "string"
                ? displayName
                : member.display_name,
          },
    membership:
      stage === "profile" || stage === "family"
        ? null
        : { familyId: family.id, role: member.role },
  };
}
export async function authenticatedClient() {
  const client = await createServerSupabaseClient<FamilyRole, LoginProvider>();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
  assertIdentityPolicy(user);
  return { client, user };
}
export async function getAccount(): Promise<Account> {
  const mock = await mockAccount();
  if (mock) return mock;
  const client = await createServerSupabaseClient<FamilyRole, LoginProvider>();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (!user) {
    if (
      error &&
      (error.status === 0 ||
        (error.status ?? 0) >= 500 ||
        error.name === "AuthRetryableFetchError")
    )
      throw new ApiError(
        "auth_unavailable",
        "로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.",
        503,
      );
    return { userId: null, profile: null, membership: null };
  }
  // Also enforce ADR-0009 for existing cookies, not only the OAuth callback.
  try {
    assertIdentityPolicy(user);
  } catch (error) {
    await client.auth.signOut();
    throw error;
  }
  const [profile, membership] = await Promise.all([
    client.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    client
      .from("memberships")
      .select("family_id, role")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  throwDatabaseError(profile.error);
  throwDatabaseError(membership.error);
  return {
    loginProvider: z.enum(providers).parse(user.identities?.[0]?.provider),
    userId: user.id,
    profile: profile.data ? { displayName: profile.data.display_name } : null,
    membership: membership.data
      ? {
          familyId: membership.data.family_id,
          role: membership.data.role,
        }
      : null,
  };
}
export async function saveProfile(input: unknown) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    let code = "validation_failed";
    if (field === "displayName") code = "display_name_invalid";
    if (field === "termsAccepted" || field === "privacyAccepted")
      code = "consent_required";
    throw new ApiError(code, issue?.message ?? "입력 내용을 확인해 주세요.");
  }
  const profile = parsed.data;
  const context = await mockContext();
  if (context) {
    const account = await mockAccount();
    if (!account?.userId)
      throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
    context.values.set(`display-name:${account.userId}`, profile.displayName);
    const family = await mockJson("family");
    family.members[context.perspective]!.display_name = profile.displayName;
    if ((context.values.get("account-stage") ?? context.stage) === "profile")
      context.values.set("account-stage", "family");
    return null;
  }
  const { client } = await authenticatedClient();
  const { error } = await client.rpc("complete_profile", {
    display_name: profile.displayName,
    terms_accepted: profile.termsAccepted,
    privacy_accepted: profile.privacyAccepted,
  });
  throwDatabaseError(error);
  return null;
}

export async function getHomeSettings() {
  const context = await mockContext();
  if (context) {
    const account = await mockAccount();
    if (!account?.userId)
      throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
    const settings = await mockJson("home-settings");
    return homeSettingsSchema.parse(
      context.values.get(`home:${account.userId}`) ?? settings,
    );
  }
  const { client, user } = await authenticatedClient();
  const { data, error } = await client
    .from("users")
    .select("home_view, upcoming_enabled, upcoming_count")
    .eq("id", user.id)
    .single();
  throwDatabaseError(error);
  return homeSettingsSchema.parse({
    homeView: data?.home_view,
    upcomingEnabled: data?.upcoming_enabled,
    upcomingCount: data?.upcoming_count,
  });
}
export async function saveHomeSettings(input: unknown) {
  const settings = homeSettingsSchema.parse(input);
  const context = await mockContext();
  if (context) {
    const account = await mockAccount();
    if (!account?.userId)
      throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
    context.values.set(`home:${account.userId}`, settings);
    return null;
  }
  const { client } = await authenticatedClient();
  const { error } = await client.rpc("save_home_settings", {
    home_view: settings.homeView,
    upcoming_enabled: settings.upcomingEnabled,
    upcoming_count: settings.upcomingCount,
  });
  throwDatabaseError(error);
  return null;
}
