import "server-only";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  throwDatabaseError,
} from "@/shared/server";
import {
  pushEndpointSchema,
  pushSubscriptionSchema,
} from "../model/push-subscription.schema";

async function subscriptionContext() {
  const mock = await mockContext();
  if (mock) {
    const stage = mock.values.get("account-stage") ?? mock.stage;
    if (stage === "login")
      throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
    return null;
  }
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
  return { client, userId: user.id };
}
export async function hasPushSubscription(endpoint: unknown) {
  const address = pushEndpointSchema.parse(endpoint);
  const context = await subscriptionContext();
  if (!context) return false;
  const { data, error } = await context.client
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", context.userId)
    .eq("endpoint", address)
    .maybeSingle();
  throwDatabaseError(error);
  return data !== null;
}
export async function savePushSubscription(input: unknown) {
  const subscription = pushSubscriptionSchema.parse(input);
  const context = await subscriptionContext();
  if (!context) return null;
  const result = await context.client
    .from("push_subscriptions")
    .upsert(
      { ...subscription, user_id: context.userId },
      { onConflict: "endpoint" },
    );
  throwDatabaseError(result.error);
  return null;
}
export async function deletePushSubscription(input: unknown) {
  const { endpoint } = z.object({ endpoint: pushEndpointSchema }).parse(input);
  const context = await subscriptionContext();
  if (!context) return null;
  const result = await context.client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", context.userId)
    .eq("endpoint", endpoint);
  throwDatabaseError(result.error);
  return null;
}
