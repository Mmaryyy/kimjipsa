import "server-only";
import { familySchema } from "../model/family.schema";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
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
export async function getFamily(): Promise<Family | null> {
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
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("create_family", {
    family_name: name,
  });
  throwDatabaseError(error);
  return data;
}
export async function createInvite(): Promise<Invitation> {
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
  const client = await createServerSupabaseClient<FamilyRole>();
  const { data, error } = await client.rpc("accept_invite", {
    invite_token: inviteToken,
  });
  throwDatabaseError(error);
  return data;
}
