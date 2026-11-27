import { z } from "zod";
import { eventSchema } from "@/entities/event/index.server";
import { cartCommandSchema } from "@/entities/cart-item/index.server";
import { inventoryInputSchema } from "@/entities/inventory-item/index.server";
import { expenseFields, taskInput } from "@/entities/project/index.server";
import {
  agentActionSchema,
  type AgentAction,
} from "@/entities/chat-message/index.server";

const categoryIdSchema = z.uuid();
const normalizeItemCategory = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const item = raw as Record<string, unknown>;
  const category = categoryIdSchema.safeParse(item.category_id);
  return { ...item, category_id: category.data ?? null };
};

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
    item: z.preprocess(normalizeItemCategory, inventoryInputSchema),
  }),
]);
const allowedCartCommand = z.preprocess(
  (raw) => {
    const payload = raw as AgentAction["payload"];
    if (payload.action !== "add" && payload.action !== "save") return raw;
    return { ...payload, item: normalizeItemCategory(payload.item) };
  },
  cartCommandSchema.refine(
    (payload) =>
      ["add", "save", "delete", "check", "restock"].includes(payload.action),
    "지원하지 않는 장바구니 작업이에요.",
  ),
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
const projectCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_task"),
    projectId: z.uuid(),
    item: taskInput.refine(({ status }) => status !== "done"),
  }),
  z.object({
    action: z.literal("set_task_done"),
    projectId: z.uuid(),
    id: z.uuid(),
    done: z.literal(true),
  }),
  z.object({
    action: z.literal("save_expense"),
    projectId: z.uuid(),
    item: expenseFields
      .refine(
        ({ actual_amount, paid_on, payer_id }) =>
          actual_amount === null || (paid_on !== null && payer_id !== null),
        "실제 결제일과 결제자를 확인해 주세요.",
      )
      .refine(
        ({ actual_amount, estimated_amount }) =>
          actual_amount !== null || estimated_amount !== null,
        "실제 금액이나 예상 금액을 입력해 주세요.",
      ),
  }),
]);
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
          payload =
            action.payload.action === "delete"
              ? z
                  .object({
                    action: z.literal("delete"),
                    id: z.uuid(),
                    occurrenceDate: z.iso.date().nullable(),
                    scope: z.enum(["single", "following"]).nullable(),
                  })
                  .parse(action.payload)
              : eventCommand.parse(action.payload);
        else if (action.domain === "inventory")
          payload = inventoryCommand.parse(action.payload);
        else if (action.domain === "project")
          payload = projectCommand.parse(action.payload);
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
