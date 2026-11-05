import { z } from "zod";
const nullableId = z.uuid().nullable();
export const cartInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "품목 이름을 입력해 주세요.")
    .refine(
      (value) => [...value].length <= 100,
      "이름은 100자 이하로 입력해 주세요.",
    ),
  quantity: z.number().finite().positive("수량은 0보다 커야 해요."),
  unit_id: nullableId,
  category_id: nullableId,
  memo: z.string().trim().max(1000),
  link_url: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^https?:\/\/[^\s]+$/, "http 또는 https 링크를 입력해 주세요.")
      .pipe(z.url())
      .transform((value) => new URL(value).href),
  ]),
  inventory_item_id: nullableId,
});
export const cartItemSchema = cartInputSchema.extend({
  id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  added_by: nullableId,
  checked_by: nullableId,
  checked_at: z.iso.datetime({ offset: true }).nullable(),
  is_checked: z.boolean(),
  purchased_at: z.iso.datetime({ offset: true }).nullable(),
});
export const restockEntrySchema = z.object({
  id: z.uuid(),
  quantity: z.number().finite().positive(),
  unit_id: z.uuid(),
  category_id: z.uuid(),
  location_id: z.uuid(),
  expires_on: z.iso.date().nullable(),
});
export const cartCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("undo-restock"), token: z.uuid() }),
  z.object({
    action: z.literal("add"),
    autoCategory: z.boolean().optional(),
    item: cartInputSchema,
    duplicate: z.enum(["ask", "merge", "separate"]).default("ask"),
  }),
  z.object({ action: z.literal("save"), id: z.uuid(), item: cartInputSchema }),
  z.object({ action: z.literal("check"), id: z.uuid(), checked: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
  z.object({
    action: z.literal("clear-checked"),
    ids: z.array(z.uuid()).min(1).max(500),
  }),
  z.object({
    action: z.literal("delete-selected"),
    ids: z.array(z.uuid()).min(1).max(500),
  }),
  z.object({
    action: z.literal("order"),
    ids: z.array(z.uuid()).min(1).max(500),
  }),
  z.object({
    action: z.literal("restock"),
    entries: z.array(restockEntrySchema).min(1).max(500),
  }),
]);
export type CartInput = z.infer<typeof cartInputSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type CartCommand = z.infer<typeof cartCommandSchema>;
export type RestockEntry = z.infer<typeof restockEntrySchema>;
