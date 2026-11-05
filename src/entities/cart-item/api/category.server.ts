import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/shared/api";
import { throwDatabaseError } from "@/shared/server";
import type { CartCommand } from "../model/cart.schema";
import type { CartWriteResult } from "./type";

export const categoryWaitMs = 2500;
const suggestionSchema = z.object({
  id: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  pending: z.boolean(),
});

export async function addWithCategory(
  client: SupabaseClient<Database>,
  command: Extract<CartCommand, { action: "add" }>,
): Promise<CartWriteResult> {
  const prepared = await client.rpc("cart_category_command", {
    operation: "prepare",
    input: { name: command.item.name },
  });
  throwDatabaseError(prepared.error, {});
  const suggestion = suggestionSchema.parse(prepared.data);
  const added = await client.rpc("cart_category_command", {
    operation: "add",
    input: {
      id: suggestion.id,
      categoryId: suggestion.categoryId,
      command: command as Json,
    },
  });
  throwDatabaseError(added.error, {
    cart_unit_mismatch: [409, "단위가 달라요. 따로 추가해 주세요."],
  });
  const result = added.data as CartWriteResult;
  if (!result.item) return result;
  const deadline = Date.now() + categoryWaitMs;
  // Only stop waiting in this HTTP request; the durable worker request keeps running.
  while (suggestion.id && suggestion.pending && Date.now() < deadline) {
    await delay(Math.min(150, deadline - Date.now()));
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const status = await client
        .rpc("cart_category_command", {
          operation: "status",
          input: { id: suggestion.id },
        })
        .abortSignal(AbortSignal.timeout(remaining));
      if (status.error) break;
      Object.assign(suggestion, suggestionSchema.parse(status.data));
    } catch {
      break;
    }
  }
  if (suggestion.categoryId) {
    result.item.category_id = suggestion.categoryId;
  }
  return result;
}
