import type { LoginProvider } from "@/entities/user";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient, request } from "@/shared/api";
import {
  isMockDataEnabled,
  mockStageCookie,
  accountApiRoutes,
  accountRoutes,
} from "@/shared/config";
import type { Account, ProfileInput } from "@/entities/user";
export function fetchAccount() {
  return request<Account>(accountApiRoutes.account);
}
export function updateProfile(input: ProfileInput) {
  return request<null>(accountApiRoutes.profile, input);
}
export async function signOut() {
  if (isMockDataEnabled()) {
    document.cookie = `${mockStageCookie}=login; Path=/; SameSite=Lax`;
    window.location.assign(accountRoutes.login);
    return;
  }
  const client = createBrowserSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error && !isAuthSessionMissingError(error)) {
    throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
  }
}
export async function signIn(
  provider: LoginProvider,
  inviteToken?: string | null,
) {
  if (isMockDataEnabled()) {
    document.cookie = `${mockStageCookie}=profile; Path=/; SameSite=Lax`;
    window.location.assign(accountRoutes.onboarding);
    return;
  }
  const client = createBrowserSupabaseClient();
  const callback = new URL(accountRoutes.callback, window.location.origin);
  if (inviteToken) callback.searchParams.set("invite", inviteToken);
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      // Override Kakao's default scopes; options.scopes only appends to them.
      ...(provider === "kakao"
        ? { queryParams: { scope: "profile_nickname" } }
        : {}),
    },
  });
  if (error) throw new Error("로그인을 시작하지 못했어요. 다시 시도해 주세요.");
}
