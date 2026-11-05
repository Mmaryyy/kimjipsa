import "server-only";
import { z } from "zod";
import { createAgentClient } from "@/entities/chat-message/index.server";
import type { Json } from "@/shared/api";
import { handleRoute, readJson, throwDatabaseError } from "@/shared/server";

const workerRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("claim") }),
  z.object({
    operation: z.enum(["complete", "fail"]),
    id: z.uuid(),
    leaseToken: z.uuid(),
    category: z.string().max(30).optional(),
  }),
]);

export function cartCategoryWorkerPOST(request: Request) {
  return handleRoute(request, async () => {
    const client = createAgentClient(request);
    const { operation, ...input } = workerRequestSchema.parse(
      await readJson(request),
    );
    const result = await client.rpc("cart_category_command", {
      operation,
      input: input as Json,
    });
    throwDatabaseError(result.error, {
      forbidden: [403, "권한이 없어요."],
      lease_lost: [409, "작업 권한이 만료되었어요."],
    });
    return result.data;
  });
}
