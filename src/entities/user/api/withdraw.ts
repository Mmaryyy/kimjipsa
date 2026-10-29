import "server-only";
import { ApiError } from "@/shared/api";
import { mockContext, mockJson, throwDatabaseError } from "@/shared/server";
import { authenticatedClient } from "./server";

const errors = {
  last_admin: [
    409,
    "먼저 구성원 목록에서 다른 구성원을 관리자로 지정해 주세요.",
  ],
  unauthorized: [401, "로그인이 필요해요."],
} as const;

export async function withdrawAccount() {
  const context = await mockContext();
  if (context) {
    const family = await mockJson("family");
    const actor = family.members[context.perspective]!;
    if (
      (context.values.get("account-stage") ?? context.stage) === "login" ||
      context.values.has(`withdrawn:${actor.user_id}`)
    ) {
      throw new ApiError("unauthorized", errors.unauthorized[1], 401);
    }
    const remaining = family.members.filter(
      (member) =>
        member.user_id !== actor.user_id &&
        !context.values.has(`withdrawn:${member.user_id}`),
    );
    if (
      remaining.length &&
      !remaining.some((member) => member.role === "admin")
    ) {
      throw new ApiError("last_admin", errors.last_admin[1], 409);
    }
    const events = await mockJson("events");
    context.values.set(
      "events",
      events.filter((event) => {
        if (event.owner_id !== actor.user_id) return true;
        if (event.visibility === "private") return false;
        event.owner_id = null;
        return true;
      }),
    );
    const cart = await mockJson("cart-items");
    for (const item of cart) {
      if (item.added_by === actor.user_id) item.added_by = null;
      if (item.checked_by === actor.user_id) item.checked_by = null;
    }
    const invitations = await mockJson("invites");
    context.values.set(
      "invites",
      invitations.filter((invitation) => {
        if (invitation.createdBy === actor.user_id && !invitation.used)
          return false;
        if (invitation.createdBy === actor.user_id) invitation.createdBy = null;
        if (invitation.acceptedBy === actor.user_id)
          invitation.acceptedBy = null;
        return true;
      }),
    );
    // Fixture member positions stay stable for the development perspective switch.
    context.values.set(`withdrawn:${actor.user_id}`, true);
    if (!remaining.length) {
      for (const name of [
        "events",
        "cart-items",
        "inventory-items",
        "invites",
      ]) {
        context.values.set(name, []);
      }
    }
    return null;
  }
  const { client } = await authenticatedClient();
  const { error } = await client.rpc("withdraw_account");
  throwDatabaseError(error, errors);
  return null;
}
