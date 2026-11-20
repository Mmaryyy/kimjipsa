import { z } from "zod";

export const projectStatuses = ["active", "completed", "archived"] as const;
export const projectModules = [
  "decisions",
  "lists",
  "reservations",
  "itinerary",
  "budget",
] as const;
export const taskStatuses = ["todo", "in_progress", "done", "on_hold"] as const;
export const assigneeKinds = ["unassigned", "together", "member"] as const;

export const projectId = z.uuid();
const title = z
  .string()
  .trim()
  .min(1, "이름이나 제목을 입력해 주세요.")
  .max(100);
const date = z.iso.date().nullable();
const note = z.string().trim().max(1000, "1,000자 이내로 입력해 주세요.");

export const projectInput = z
  .object({
    title,
    description: note,
    starts_on: date,
    target_on: date,
    status: z.enum(projectStatuses),
    modules: z.array(z.enum(projectModules)),
  })
  .refine(
    ({ starts_on, target_on }) =>
      !starts_on || !target_on || starts_on <= target_on,
    {
      path: ["target_on"],
      message: "목표일은 시작일 이후로 입력해 주세요.",
    },
  );

export const areaInput = z.object({ name: title });
export const areaSortOrder = z.int().min(0).max(2147483647);

export const milestoneInput = z
  .object({
    title,
    area_id: projectId.nullable(),
    starts_on: date,
    ends_on: date,
    is_tentative: z.boolean(),
    memo: note,
  })
  .refine(
    ({ is_tentative, starts_on, ends_on }) =>
      is_tentative ? !starts_on && !ends_on : Boolean(starts_on),
    {
      path: ["starts_on"],
      message: "시작일을 입력하거나 날짜 미정을 선택해 주세요.",
    },
  )
  .refine(
    ({ starts_on, ends_on }) => !starts_on || !ends_on || starts_on <= ends_on,
    {
      path: ["ends_on"],
      message: "종료일은 시작일 이후로 입력해 주세요.",
    },
  );

export const taskInput = z
  .object({
    title,
    area_id: projectId.nullable(),
    assignee_kind: z.enum(assigneeKinds),
    assignee_id: projectId.nullable(),
    status: z.enum(taskStatuses),
    starts_on: date,
    due_on: date,
    depends_note: note,
    memo: note,
  })
  .refine(
    ({ assignee_kind, assignee_id }) =>
      (assignee_kind === "member") === Boolean(assignee_id),
    {
      path: ["assignee_id"],
      message: "담당자를 다시 선택해 주세요.",
    },
  )
  .refine(
    ({ starts_on, due_on }) => !starts_on || !due_on || starts_on <= due_on,
    {
      path: ["due_on"],
      message: "마감일은 시작일 이후로 입력해 주세요.",
    },
  );

const child = { projectId, id: projectId.optional() };
const existing = { projectId, id: projectId };
export const projectCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_project"),
    id: projectId.optional(),
    item: projectInput,
  }),
  z.object({ action: z.literal("delete_project"), id: projectId }),
  z.object({
    action: z.literal("save_area"),
    ...child,
    item: areaInput.extend({ sort_order: areaSortOrder.optional() }),
  }),
  z.object({
    action: z.literal("reorder_areas"),
    projectId,
    areaIds: z.array(projectId).min(1),
  }),
  z.object({ action: z.literal("delete_area"), ...existing }),
  z.object({
    action: z.literal("save_milestone"),
    ...child,
    item: milestoneInput,
  }),
  z.object({ action: z.literal("delete_milestone"), ...existing }),
  z.object({ action: z.literal("save_task"), ...child, item: taskInput }),
  z.object({ action: z.literal("delete_task"), ...existing }),
  z.object({
    action: z.literal("set_task_done"),
    ...existing,
    done: z.boolean(),
  }),
]);

export type ProjectInput = z.infer<typeof projectInput>;
export type AreaInput = z.infer<typeof areaInput>;
export type MilestoneInput = z.infer<typeof milestoneInput>;
export type TaskInput = z.infer<typeof taskInput>;
export type ProjectCommand = z.infer<typeof projectCommand>;
