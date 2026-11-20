import { z } from "zod";

export const todoFields = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요."),
  due_on: z.iso.date().nullable(),
  visibility: z.enum(["shared", "private"]),
});

export const todoRow = todoFields.extend({
  id: z.uuid(),
  owner_id: z.uuid().nullable(),
  completed_at: z.string().nullable(),
  completed_by: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const todoCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    id: z.uuid().optional(),
    item: todoFields,
  }),
  z.object({ action: z.literal("set_done"), id: z.uuid(), done: z.boolean() }),
  z.object({ action: z.literal(["delete", "undo"]), id: z.uuid() }),
]);

export type TodoFields = z.infer<typeof todoFields>;
export type Todo = z.infer<typeof todoRow>;
export type TodoCommand = z.infer<typeof todoCommand>;
