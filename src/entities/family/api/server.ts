import "server-only";
import { familySchema } from "../model/family.schema";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  mockContext,
  mockJson,
  createServerSupabaseClient,
  throwDatabaseError as throwSharedDatabaseError,
} from "@/shared/server";
import type { Family, Invitation, InvitePreview } from "./type";
import { roles, type FamilyRole } from "../model/roles.constants";
const databaseErrors = {
  unauthorized: [401, "로그인이 필요해요."],
  forbidden: [403, "관리자만 초대 링크를 만들 수 있어요."],
  profile_required: [409, "약관에 동의하고 표시 이름을 먼저 정해 주세요."],
  already_in_family: [409, "이미 가정에 속해 있어요."],
  invite_not_found: [404, "초대 링크를 찾을 수 없어요."],
  invite_used: [409, "이미 사용된 초대 링크예요. 새 링크를 요청해 주세요."],
  invite_expired: [410, "만료된 초대 링크예요. 새 링크를 요청해 주세요."],
  family_name_required: [400, "가정 이름을 입력해 주세요."],
  family_name_too_long: [400, "가정 이름은 10자 이하로 입력해 주세요."],
} as const;
function throwDatabaseError(error: { message: string } | null) {
  throwSharedDatabaseError(error, databaseErrors);
}
const membersSchema = z.array(
  z.object({
    user_id: z.string(),
    display_name: z.string(),
    role: z.enum(Object.keys(roles) as [FamilyRole, ...FamilyRole[]]),
  }),
);

const invitationSchema = z.object({ token: z.uuid(), expires_at: z.string() });
const previewSchema = z.union([
  z.object({ status: z.literal("valid"), familyName: z.string() }),
  z.object({ status: z.enum(["used", "expired", "not_found"]) }),
]);
async function mockFamily() {
  return mockJson("family");
}
async function mockInvites() {
  return mockJson("invites");
}
async function requireMockMember(admin = false) {
  const context = await mockContext();
  if (!context) throw new Error("테스트 데이터가 꺼져 있어요.");
  if (context.stage === "login")
    throw new ApiError("unauthorized", databaseErrors.unauthorized[1], 401);
  const family = await mockFamily();
  const member = family.members[context.perspective]!;
  if (admin && member.role !== "admin")
    throw new ApiError("forbidden", databaseErrors.forbidden[1], 403);
  return { context, family, member };
}
export async function getFamily(): Promise<Family | null> {
  if (await mockContext()) {
    const { family, context } = await requireMockMember();
    const stage = context.values.get("account-stage") ?? context.stage;
    if (stage === "profile" || stage === "family") return null;
    return family;
  }
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data: families, error } = await client
    .from("families")
    .select("id, name")
    .maybeSingle();
  throwDatabaseError(error);
  if (!families) return null;
  const { data: members, error: membersError } =
    await client.rpc("family_members");
  throwDatabaseError(membersError);
  if (!members)
    throw new ApiError("database_error", "구성원을 불러오지 못했어요.", 500);
  return { ...families, members: membersSchema.parse(members) };
}
export async function createFamily(input: unknown) {
  const { name } = familySchema.parse(input);
  if (await mockContext()) {
    const { context, family } = await requireMockMember();
    const stage = context.values.get("account-stage") ?? context.stage;
    if (stage === "profile")
      throw new ApiError(
        "profile_required",
        databaseErrors.profile_required[1],
        409,
      );
    if (stage !== "family")
      throw new ApiError(
        "already_in_family",
        databaseErrors.already_in_family[1],
        409,
      );
    family.name = name;
    context.values.set("account-stage", "ready");
    return family.id;
  }
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("create_family", {
    family_name: name,
  });
  throwDatabaseError(error);
  return data;
}
export async function createInvite(): Promise<Invitation> {
  if (await mockContext()) {
    await requireMockMember(true);
    const invitation = {
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    };
    (await mockInvites()).push({ ...invitation, used: false });
    return invitation;
  }
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("create_invite");
  throwDatabaseError(error);
  if (!data)
    throw new ApiError("database_error", "초대 링크를 만들지 못했어요.", 500);
  const invitation = invitationSchema.safeParse(data);
  if (!invitation.success)
    throw new ApiError(
      "invalid_response",
      "초대 링크를 읽지 못했어요. 다시 시도해 주세요.",
      500,
    );
  return {
    token: invitation.data.token,
    expiresAt: invitation.data.expires_at,
  };
}
export async function previewInvite(token: string): Promise<InvitePreview> {
  const parsed = z.uuid().safeParse(token);
  if (!parsed.success) return { status: "not_found" };
  const context = await mockContext();
  if (context) {
    const invitation = (await mockInvites()).find(
      (entry) => entry.token === token,
    );
    if (!invitation) return { status: "not_found" };
    if (invitation.used) return { status: "used" };
    if (new Date(invitation.expiresAt).getTime() <= Date.now())
      return { status: "expired" };
    return { status: "valid", familyName: (await mockFamily()).name };
  }
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("preview_invite", {
    invite_token: parsed.data,
  });
  throwDatabaseError(error);
  const preview = previewSchema.safeParse(data);
  if (!preview.success)
    throw new ApiError(
      "invalid_response",
      "초대를 확인하지 못했어요. 다시 시도해 주세요.",
      500,
    );
  return preview.data;
}
export async function acceptInvite(token: string) {
  const inviteToken = z.uuid("초대 링크를 확인해 주세요.").parse(token);
  if (await mockContext()) {
    const { context, family } = await requireMockMember();
    const stage = context.values.get("account-stage") ?? context.stage;
    if (stage === "profile")
      throw new ApiError(
        "profile_required",
        databaseErrors.profile_required[1],
        409,
      );
    if (stage !== "family")
      throw new ApiError(
        "already_in_family",
        databaseErrors.already_in_family[1],
        409,
      );
    const preview = await previewInvite(inviteToken);
    if (preview.status !== "valid") {
      const code =
        preview.status === "used"
          ? "invite_used"
          : preview.status === "expired"
            ? "invite_expired"
            : "invite_not_found";
      throw new ApiError(
        code,
        databaseErrors[code][1],
        databaseErrors[code][0],
      );
    }
    const invitation = (await mockInvites()).find(
      (entry) => entry.token === inviteToken,
    )!;
    invitation.used = true;
    context.values.set("account-stage", "ready");
    return family.id;
  }
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("accept_invite", {
    invite_token: inviteToken,
  });
  throwDatabaseError(error);
  return data;
}
