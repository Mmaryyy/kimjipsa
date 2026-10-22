import "server-only";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import {
  notificationSchema,
  markNotificationsSchema,
} from "../model/notification.schema";
async function notificationContext() {
  const mock = await mockContext();
  if (mock) {
    const stage = mock.values.get("account-stage") ?? mock.stage;
    if (stage === "login")
      throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
    if (stage === "profile" || stage === "family")
      throw new ApiError("family_required", "가정에 먼저 참여해 주세요.", 403);
    const family = await mockJson("family");
    return {
      mock,
      userId: family.members[mock.perspective]!.user_id,
      familyId: family.id,
    };
  }
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error);
  if (!membership.data)
    throw new ApiError("family_required", "가정에 먼저 참여해 주세요.", 403);
  return { client, userId: user.id, familyId: membership.data.family_id };
}
export async function listNotifications() {
  const context = await notificationContext();
  if (context.mock)
    return (await mockJson("notifications"))
      .filter(
        (entry) =>
          entry.user_id === context.userId &&
          entry.family_id === context.familyId,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);
  const { data, error } = await context.client
    .from("notifications")
    .select("id, user_id, family_id, kind, payload, read_at, created_at")
    .eq("user_id", context.userId)
    .eq("family_id", context.familyId)
    .order("created_at", { ascending: false })
    .limit(30);
  throwDatabaseError(error);
  return z.array(notificationSchema).parse(data);
}
export async function markNotificationsRead(input: unknown) {
  const { id } = markNotificationsSchema.parse(input);
  const context = await notificationContext();
  const now = new Date().toISOString();
  if (context.mock) {
    for (const entry of await mockJson("notifications")) {
      if (
        entry.user_id === context.userId &&
        entry.family_id === context.familyId &&
        entry.read_at === null &&
        (!id || entry.id === id)
      )
        entry.read_at = now;
    }
    return null;
  }
  let query = context.client
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", context.userId)
    .eq("family_id", context.familyId)
    .is("read_at", null);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  throwDatabaseError(error);
  return null;
}
