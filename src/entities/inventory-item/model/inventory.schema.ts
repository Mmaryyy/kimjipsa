import { z } from "zod";

// Default category names also restore their original decorative icon in the editor.
export const inventoryDefaultIcons: Record<string, string> = {
  "채소·과일": "carrot",
  "정육·수산": "beef",
  "유제품·계란": "milk",
  가공식품: "pizza",
  음료: "cup-soda",
  "양념·소스": "flask-round",
  생활용품: "soap-dispenser-droplet",
  "건강·뷰티": "heart-pulse",
  기타: "tag",
};
export const inventoryStatusOptions = [
  { value: "enough", label: "충분" },
  { value: "low", label: "부족" },
  { value: "none", label: "없음" },
] as const;
export const inventoryKindSchema = z.enum(["categories", "locations", "units"]);
export const inventoryItemSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "품목 이름을 입력해 주세요.")
    .refine(
      (name) => [...name].length <= 100,
      "품목 이름은 100자 이하로 입력해 주세요.",
    ),
  mode: z.enum(["quantity", "status"]),
  quantity: z
    .number({ error: "수량을 입력해 주세요." })
    .finite()
    .nonnegative("수량은 0 이상으로 입력해 주세요."),
  status: z.enum(inventoryStatusOptions.map((option) => option.value)),
  unit_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  location_id: z.uuid().nullable(),
  min_quantity: z.number().finite().nonnegative().nullable(),
  expires_on: z.iso.date().nullable(),
});
export const inventoryInputSchema = inventoryItemSchema
  .omit({ id: true })
  .refine((item) => item.mode !== "quantity" || item.unit_id !== null, {
    path: ["unit_id"],
    message: "단위를 선택해 주세요.",
  })
  .transform((item): Omit<z.infer<typeof inventoryItemSchema>, "id"> =>
    item.mode === "status"
      ? { ...item, quantity: 0, unit_id: null, min_quantity: null }
      : { ...item, status: "enough" as const },
  );
const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" });
export function isVisibleCharacter(value: string) {
  if (value === "") return true;
  const visible = value.replace(/[\u200d\ufe0f]/gu, "");
  return (
    [...graphemes.segment(value)].length === 1 &&
    visible.length > 0 &&
    !/[\p{C}\p{Z}]/u.test(visible) &&
    /[^\p{M}]/u.test(visible)
  );
}
export const inventoryMetaEntrySchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .refine(
      (name) => [...name].length <= 30,
      "이름은 30자 이하로 입력해 주세요.",
    ),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0),
  icon_kind: z.enum(["lucide", "text"]).nullable().default(null),
  icon_value: z.string().default(""),
});
export const inventoryMetaInputSchema = inventoryMetaEntrySchema
  .omit({ id: true })
  .extend({
    enabled: z.boolean(),
    sort_order: z.number().int().nonnegative(),
    icon_kind: z.enum(["lucide", "text"]).nullable(),
    icon_value: z.string(),
  })
  .refine(
    (entry) =>
      entry.icon_kind === "text"
        ? entry.icon_value !== "" && isVisibleCharacter(entry.icon_value)
        : entry.icon_kind === "lucide"
          ? Object.values(inventoryDefaultIcons).includes(entry.icon_value)
          : entry.icon_value === "",
    {
      path: ["icon_value"],
      message: "아이콘은 보이는 문자 한 글자로 입력해 주세요.",
    },
  );
export const inventoryMetaSchema = z.object({
  categories: z.array(inventoryMetaEntrySchema),
  locations: z.array(inventoryMetaEntrySchema),
  units: z.array(inventoryMetaEntrySchema),
  expiry_days: z.number().int().min(0).max(30),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export type InventoryMeta = z.infer<typeof inventoryMetaSchema>;
export type InventoryMetaEntry = z.infer<typeof inventoryMetaEntrySchema>;
export type InventoryMetaInput = z.infer<typeof inventoryMetaInputSchema>;
export type InventoryListKind = z.infer<typeof inventoryKindSchema>;
