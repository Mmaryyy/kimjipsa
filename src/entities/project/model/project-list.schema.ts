import { z } from "zod";

export const listKinds = ["candidates", "people"] as const;
export const columnTypes = ["text", "number", "money", "select"] as const;
export const candidateStatuses = ["candidate", "selected", "excluded"] as const;

const id = z.uuid();
const name = z.string().trim().min(1, "이름을 입력해 주세요.").max(100);
const label = z.object({ key: id, label: name });
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const tags = z
  .array(label)
  .refine((rows) => unique(rows.map((row) => row.key)));
const money = z.number().min(0).max(Number.MAX_SAFE_INTEGER);
const column = label
  .extend({
    type: z.enum(columnTypes),
    options: z
      .array(z.string())
      .transform((values) =>
        values.map((value) => value.trim()).filter(Boolean),
      )
      .refine(
        (values) => values.every((value) => value.length <= 100),
        "옵션은 100자 이내로 입력해 주세요.",
      )
      .refine(unique, "선택 옵션이 중복돼요."),
  })
  .refine(
    ({ type, options }) =>
      type === "select" ? options.length > 0 : options.length === 0,
    { path: ["options"], message: "선택 칸의 옵션을 입력해 주세요." },
  );

export const projectListInput = z
  .object({
    name,
    kind: z.enum(listKinds),
    columns: z
      .array(column)
      .refine((rows) => unique(rows.map((row) => row.key))),
    tags,
    quantity_list_id: id.nullable(),
    quantity_tag_key: id.nullable(),
  })
  .refine(
    (list) =>
      list.kind === "people"
        ? !list.quantity_list_id && !list.quantity_tag_key
        : list.tags.length === 0 &&
          Boolean(list.quantity_list_id) === Boolean(list.quantity_tag_key),
    {
      path: ["quantity_tag_key"],
      message: "명단과 태그를 함께 선택해 주세요.",
    },
  );

export const projectListLinks = z.array(
  z
    .string()
    .trim()
    .max(2048)
    .regex(/^https?:\/\/[^/\s]+[^\s]*$/i)
    .pipe(z.url()),
);
export const projectListItemInput = z
  .object({
    title: name,
    status: z.enum(candidateStatuses).nullable(),
    price: money.nullable(),
    links: projectListLinks,
    values: z.record(id, z.union([z.string().max(1000), z.number()])),
    tags: z.array(id).refine(unique),
    done_tags: z.array(id).refine(unique),
    memo: z.string().trim().max(1000),
  })
  .refine((item) => item.done_tags.every((key) => item.tags.includes(key)), {
    path: ["done_tags"],
    message: "사람에게 붙인 태그만 완료할 수 있어요.",
  });

export type ProjectListInput = z.infer<typeof projectListInput>;
export type ProjectListItemInput = z.infer<typeof projectListItemInput>;
export type ProjectColumn = z.infer<typeof column>;

export function validProjectValues(
  columns: ProjectColumn[],
  values: ProjectListItemInput["values"],
) {
  return Object.entries(values).every(([key, value]) => {
    const column = columns.find((entry) => entry.key === key);
    switch (column?.type) {
      case "text":
        return typeof value === "string" && value.length <= 1000;
      case "number":
        return typeof value === "number" && Number.isFinite(value);
      case "money":
        return money.safeParse(value).success;
      case "select":
        return typeof value === "string" && column.options.includes(value);
      default:
        return false;
    }
  });
}

const parent = { projectId: id };
const list = { ...parent, listId: id };
const item = { ...list, id };
export const projectListCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_list"),
    ...parent,
    id: id.optional(),
    item: projectListInput,
  }),
  z.object({ action: z.literal("delete_list"), ...parent, id }),
  z.object({ action: z.literal("disconnect_list_quantity"), ...parent, id }),
  z.object({
    action: z.literal("save_list_item"),
    ...list,
    id: id.optional(),
    item: projectListItemInput,
  }),
  z.object({ action: z.literal("delete_list_item"), ...item }),
  z.object({
    action: z.literal("set_list_tag_done"),
    ...item,
    tagKey: id,
    done: z.boolean(),
  }),
  z.object({ action: z.literal("delete_list_photo"), ...item, photoId: id }),
]);
export type ProjectListCommand = z.infer<typeof projectListCommand>;
