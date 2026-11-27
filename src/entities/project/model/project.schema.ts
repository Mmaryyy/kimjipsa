import { z } from "zod";
import { projectListCommand } from "./project-list.schema";

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

export const decisionStatuses = ["discussing", "decided", "on_hold"] as const;
export const reservationKinds = [
  "lodging",
  "transport",
  "restaurant",
  "activity",
  "other",
] as const;
export const reservationStatuses = [
  "reviewing",
  "planned",
  "booked",
  "cancelled",
] as const;
export const projectEventSources = [
  "milestones",
  "reservations",
  "itinerary",
] as const;

export const opinionInput = z.object({ user_id: projectId, opinion: note });
export const decisionOpinionInput = opinionInput.pick({ opinion: true });
export const decisionReactions = ["up", "down"] as const;
export type DecisionReaction = (typeof decisionReactions)[number];

export const decisionInput = z.object({
  question: title,
  status: z.enum(decisionStatuses),
  due_on: date,
  options: note,
  final_choice: note,
  opinions: z.array(opinionInput),
});

const projectLink = z
  .string()
  .max(2048)
  .regex(/^https?:\/\/[^/\s]+[^\s]*$/i)
  .pipe(z.url());
const links = z
  .array(z.string())
  .transform((values) => values.map((value) => value.trim()).filter(Boolean))
  .refine(
    (values) => values.every((value) => projectLink.safeParse(value).success),
    "2,048자 이내의 http 또는 https 링크를 입력해 주세요.",
  );
const amount = z.number().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
const endsAfterStart = ({
  starts_on,
  ends_on,
}: {
  starts_on: string | null;
  ends_on: string | null;
}) => !ends_on || (starts_on !== null && starts_on <= ends_on);
const endDateError = {
  path: ["ends_on"],
  message: "종료일은 시작일 이후로 입력해 주세요.",
};

export const reservationInput = z
  .object({
    title,
    area_id: projectId.nullable(),
    kind: z.enum(reservationKinds),
    status: z.enum(reservationStatuses),
    starts_on: date,
    ends_on: date,
    reference_no: z.string().trim().max(100),
    links,
    cancel_deadline: date,
    payment_deadline: date,
    total_amount: amount,
    paid_amount: amount,
    memo: note,
  })
  .refine(endsAfterStart, endDateError)
  .refine(
    ({ paid_amount, total_amount }) =>
      paid_amount === null ||
      (total_amount !== null && paid_amount <= total_amount),
    { path: ["paid_amount"], message: "결제액은 총액 이내로 입력해 주세요." },
  );

export const itineraryInput = z
  .object({
    starts_on: date,
    ends_on: date,
    place: note,
    title,
    links,
    memo: note,
  })
  .refine(({ starts_on }) => starts_on !== null, {
    path: ["starts_on"],
    message: "날짜를 입력해 주세요.",
  })
  .refine(endsAfterStart, endDateError);

const won = z.int().nonnegative().nullable();
export const expenseFields = z.object({
  title,
  area_id: projectId.nullable(),
  estimated_amount: won,
  planned_on: date,
  actual_amount: won,
  paid_on: date,
  payer_id: projectId.nullable(),
  links,
  memo: note,
});

export const expenseInput = (allowMissingPayer = false) =>
  expenseFields
    .refine(
      ({ actual_amount, paid_on }) =>
        actual_amount === null || paid_on !== null,
      {
        path: ["paid_on"],
        message: "실제 결제일을 선택해 주세요.",
      },
    )
    .refine(
      ({ actual_amount, payer_id }) =>
        allowMissingPayer || actual_amount === null || payer_id !== null,
      {
        path: ["payer_id"],
        message: "결제자를 선택해 주세요.",
      },
    );

export const budgetLimitInput = z.object({ budget_limit: won });
export type ExpenseInput = z.infer<typeof expenseFields>;

const child = { projectId, id: projectId.optional() };
const existing = { projectId, id: projectId };
export const projectModuleCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_decision"),
    ...child,
    item: decisionInput,
  }),
  z.object({ action: z.literal("delete_decision"), ...existing }),
  z.object({
    action: z.literal("save_decision_opinion"),
    ...existing,
    item: decisionOpinionInput,
  }),
  z.object({
    action: z.literal("set_decision_opinion_reaction"),
    ...existing,
    opinionId: projectId,
    reaction: z.enum(decisionReactions).nullable(),
  }),
  z.object({
    action: z.literal("save_reservation"),
    ...child,
    item: reservationInput,
  }),
  z.object({ action: z.literal("delete_reservation"), ...existing }),
  z.object({
    action: z.literal("save_itinerary"),
    ...child,
    item: itineraryInput,
  }),
  z.object({ action: z.literal("delete_itinerary"), ...existing }),
  z.object({
    action: z.literal("add_project_event"),
    ...existing,
    source: z.enum(projectEventSources),
  }),
]);
export const projectBudgetCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save_expense"),
      ...child,
      item: expenseInput(true),
      budget_limit: won.optional(),
    })
    .refine(
      ({ id, item }) =>
        id !== undefined ||
        item.actual_amount === null ||
        item.payer_id !== null,
      { path: ["item", "payer_id"], message: "결제자를 선택해 주세요." },
    ),
  z.object({ action: z.literal("delete_expense"), ...existing }),
  z.object({
    action: z.literal("set_budget_limit"),
    projectId,
    ...budgetLimitInput.shape,
  }),
]);
export type ProjectBudgetCommand = z.infer<typeof projectBudgetCommand>;

export const projectCommand = z.discriminatedUnion("action", [
  projectModuleCommand,
  projectBudgetCommand,
  projectListCommand,
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

export type DecisionInput = z.infer<typeof decisionInput>;
export type ReservationInput = z.infer<typeof reservationInput>;
export type ItineraryInput = z.infer<typeof itineraryInput>;
export type ProjectModuleCommand = z.infer<typeof projectModuleCommand>;
export type ProjectEventSource = (typeof projectEventSources)[number];
