import { z } from "zod";
import { eventSchema } from "@/entities/event/index.server";
import { cartCommandSchema } from "@/entities/cart-item/index.server";
import { inventoryInputSchema } from "@/entities/inventory-item/index.server";
import {
  agentActionSchema,
  type AgentAction,
} from "@/entities/chat-message/index.server";

const inventoryCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("adjust"),
    id: z.uuid(),
    delta: z.number().finite(),
  }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
  z.object({ action: z.literal("used-up"), id: z.uuid() }),
  z.object({
    action: z.literal("status"),
    id: z.uuid(),
    status: z.enum(["enough", "low", "none"]),
  }),
  z.object({
    action: z.literal("save"),
    id: z.uuid().nullable(),
    item: inventoryInputSchema,
  }),
]);
const allowedCartCommand = cartCommandSchema.refine(
  (payload) => ["add", "check", "restock"].includes(payload.action),
  "지원하지 않는 장바구니 작업이에요.",
);
const eventCommand = z.object({
  id: z.uuid().nullable(),
  occurrenceDate: z.iso.date().nullable().default(null),
  event: z.preprocess((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const event = raw as Record<string, unknown>;
    return {
      ...event,
      place: event.place ?? "",
      memo: event.memo ?? "",
      celebrateMessage: event.celebrateMessage ?? "",
    };
  }, eventSchema),
});
export function parseAgentActions(raw: unknown): AgentAction[] {
  return z
    .array(agentActionSchema)
    .min(1)
    .max(20)
    .parse(raw)
    .map((action, index) => {
      try {
        let payload;
        if (action.domain === "event")
          payload = eventCommand.parse(action.payload);
        else if (action.domain === "inventory")
          payload = inventoryCommand.parse(action.payload);
        else {
          payload = allowedCartCommand.parse(action.payload);
        }
        return { ...action, payload };
      } catch (error) {
        if (error instanceof z.ZodError)
          throw new z.ZodError(
            error.issues.map((issue) => ({
              ...issue,
              path: ["actions", index, "payload", ...issue.path],
            })),
          );
        throw error;
      }
    });
}
