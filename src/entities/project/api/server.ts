import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import {
  projectListCommand,
  type ProjectListCommand,
} from "../model/project-list.schema";
import { readMockLists, writeMockList } from "./list-mock.server";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import {
  projectCommand,
  projectBudgetCommand,
  type ProjectBudgetCommand,
  projectId,
  projectModuleCommand,
  type ProjectCommand,
  type ProjectModuleCommand,
  taskStatuses,
} from "../model/project.schema";
import {
  projectOverdue,
  projectProgress,
  upcomingTasks,
} from "../model/progress.utils";
import { projectToday } from "../model/project-date.utils";
import {
  clearMockProjectLinks,
  writeProjectModuleMock,
  type CreateProjectMockEvent,
} from "./module-mock.server";
import {
  projectMock,
  writeProjectMock,
  writeProjectBudgetMock,
} from "./mock.server";
import {
  areaRow,
  candidateRecipientRow,
  candidateVoteRow,
  decisionRow,
  reservationRow,
  itineraryRow,
  milestoneRow,
  projectRow,
  projectListEntry,
  projectListRow,
  projectListItemRow,
  projectPhotoRow,
  taskRow,
  expenseRow,
  homeDeadlineRow,
  type HomeDeadline,
  type ProjectDetail,
  type ProjectList,
} from "./type";

export const projectWriteErrors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  project_not_found: [404, "프로젝트 항목을 찾을 수 없어요."],
  photo_upload_failed: [502, "사진을 올리지 못했어요. 다시 시도해 주세요."],
  project_columns_in_use: [
    400,
    "입력된 칸 값과 맞지 않는 옵션이나 유형이에요.",
  ],
  invalid_project: [400, "프로젝트 항목의 입력을 확인해 주세요."],
} as const;

export async function projectContext() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", projectWriteErrors.unauthorized[1], 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error);
  if (!membership.data)
    throw new ApiError(
      "family_required",
      projectWriteErrors.family_required[1],
      403,
    );
  return { client, familyId: membership.data.family_id };
}

async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string; code?: string } | null;
  }>,
) {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await page(offset, offset + size - 1);
    throwDatabaseError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

const summaryTask = z.object({
  project_id: projectId,
  title: z.string(),
  status: z.enum(taskStatuses),
  due_on: z.iso.date().nullable(),
});

export async function listProjects(): Promise<ProjectList> {
  const mock = await mockContext();
  const mockFamily = mock && (await mockJson("family"));
  const { projects, tasks, familyId } =
    mock && mockFamily
      ? {
          ...projectMock(mock.values, mockFamily.members),
          familyId: mockFamily.id,
        }
      : await readList();
  const byProject = Map.groupBy(tasks, (task) => task.project_id);
  const today = projectToday();
  return {
    familyId,
    entries: projects.map((project) => {
      const items = byProject.get(project.id) ?? [];
      const next = upcomingTasks(items, today)[0];
      return projectListEntry.parse({
        project,
        progress: projectProgress(items),
        overdue: projectOverdue(items, today),
        next: next && { title: next.title, due_on: next.due_on },
      });
    }),
  };
}

async function readList() {
  const { client, familyId } = await projectContext();
  const [projects, tasks] = await Promise.all([
    allRows((from, to) =>
      client
        .from("projects")
        .select("*")
        .eq("family_id", familyId)
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      client
        .from("project_tasks")
        .select("project_id,title,status,due_on")
        .eq("family_id", familyId)
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    familyId,
    projects: projectRow.array().parse(projects),
    tasks: summaryTask.array().parse(tasks),
  };
}

export async function readHomeDeadlines(): Promise<HomeDeadline[]> {
  const mock = await mockContext();
  if (!mock) {
    const { client } = await projectContext();
    const { data, error } = await client.rpc("home_project_deadlines");
    throwDatabaseError(error, projectWriteErrors);
    return z.array(homeDeadlineRow).parse(data);
  }

  const { members } = await mockJson("family");
  const store = projectMock(mock.values, members);
  const today = projectToday();
  const end = format(addDays(parseISO(today), 6), "yyyy-MM-dd");
  const rows: HomeDeadline[] = [];
  for (const project of store.projects) {
    if (project.status !== "active") continue;
    const push = (
      id: string,
      title: string,
      kind: HomeDeadline["kind"],
      date: string | null,
      assigneeKind: HomeDeadline["assigneeKind"] = null,
      assigneeId: string | null = null,
    ) => {
      if (date && date >= today && date <= end)
        rows.push({
          id,
          projectId: project.id,
          projectTitle: project.title,
          title,
          kind,
          date,
          assigneeKind,
          assigneeId,
        });
    };
    for (const task of store.tasks) {
      if (task.project_id === project.id && task.status !== "done")
        push(
          task.id,
          task.title,
          "task",
          task.due_on,
          task.assignee_kind,
          task.assignee_id,
        );
    }
    for (const decision of store.decisions) {
      if (
        project.modules.includes("decisions") &&
        decision.project_id === project.id &&
        decision.status === "discussing"
      )
        push(decision.id, decision.question, "decision", decision.due_on);
    }
    for (const reservation of store.reservations) {
      if (
        !project.modules.includes("reservations") ||
        reservation.project_id !== project.id ||
        reservation.status === "cancelled"
      )
        continue;
      push(
        reservation.id,
        reservation.title,
        "reservation_cancel",
        reservation.cancel_deadline,
      );
      if ((reservation.total_amount ?? 0) > (reservation.paid_amount ?? 0))
        push(
          reservation.id,
          reservation.title,
          "reservation_payment",
          reservation.payment_deadline,
        );
    }
  }
  return rows
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.kind.localeCompare(b.kind) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}

export async function readProject(rawId: string): Promise<ProjectDetail> {
  const id = projectId.parse(rawId);
  const mock = await mockContext();
  if (mock) {
    const family = await mockJson("family");
    const store = projectMock(mock.values, family.members);
    await clearMockProjectLinks(store);
    const project = store.projects.find((row) => row.id === id);
    if (!project)
      throw new ApiError(
        "project_not_found",
        projectWriteErrors.project_not_found[1],
        404,
      );
    return {
      familyId: family.id,
      ...readMockLists(store, id),
      project,
      expenses: project.modules.includes("budget")
        ? store.expenses.filter((row) => row.project_id === id)
        : [],
      areas: store.areas
        .filter((row) => row.project_id === id)
        .sort((a, b) => a.sort_order - b.sort_order),
      milestones: store.milestones.filter((row) => row.project_id === id),
      tasks: store.tasks.filter((row) => row.project_id === id),
      members: family.members.filter(
        ({ user_id }) => !mock.values.has(`withdrawn:${user_id}`),
      ),
      decisions: project.modules.includes("decisions")
        ? store.decisions.filter((row) => row.project_id === id)
        : [],
      reservations: project.modules.includes("reservations")
        ? store.reservations.filter((row) => row.project_id === id)
        : [],
      itinerary: project.modules.includes("itinerary")
        ? store.itinerary.filter((row) => row.project_id === id)
        : [],
    };
  }

  const { client, familyId } = await projectContext();
  const project = await client
    .from("projects")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", id)
    .maybeSingle();
  throwDatabaseError(project.error);
  if (!project.data)
    throw new ApiError(
      "project_not_found",
      projectWriteErrors.project_not_found[1],
      404,
    );
  const parsedProject = projectRow.parse(project.data);
  const modules = parsedProject.modules;
  const [
    areas,
    milestones,
    tasks,
    members,
    decisions,
    reservations,
    itinerary,
    lists,
    listItems,
    candidateRecipients,
    candidateVotes,
    photos,
    expenses,
  ] = await Promise.all([
    allRows((from, to) =>
      client
        .from("project_areas")
        .select("*")
        .eq("family_id", familyId)
        .eq("project_id", id)
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      client
        .from("project_milestones")
        .select("*")
        .eq("family_id", familyId)
        .eq("project_id", id)
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      client
        .from("project_tasks")
        .select("*")
        .eq("family_id", familyId)
        .eq("project_id", id)
        .order("id")
        .range(from, to),
    ),
    client.rpc("family_members"),
    modules.includes("decisions")
      ? allRows((from, to) =>
          client
            .from("project_decisions")
            .select(
              `
              *,
              opinions:project_decision_opinions(id,user_id,opinion,
                reactions:project_decision_opinion_reactions(user_id,reaction))
            `,
            )
            .eq("family_id", familyId)
            .eq("project_id", id)
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("reservations")
      ? allRows((from, to) =>
          client
            .from("project_reservations")
            .select("*")
            .eq("family_id", familyId)
            .eq("project_id", id)
            .order("starts_on")
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("itinerary")
      ? allRows((from, to) =>
          client
            .from("project_itinerary")
            .select("*")
            .eq("family_id", familyId)
            .eq("project_id", id)
            .order("starts_on")
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("lists")
      ? allRows((from, to) =>
          client
            .from("project_lists")
            .select("*")
            .eq("family_id", familyId)
            .eq("project_id", id)
            .order("sort_order")
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("lists")
      ? allRows((from, to) =>
          client
            .from("project_list_items")
            .select("*,project_lists!inner(project_id)")
            .eq("family_id", familyId)
            .eq("project_lists.project_id", id)
            .order("sort_order")
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("lists")
      ? allRows((from, to) =>
          client
            .from("project_candidate_recipients")
            .select(
              "list_id,candidate_id,person_id,candidate:project_list_items!project_candidate_recipients_candidate_fkey!inner(project_lists!inner(project_id))",
            )
            .eq("family_id", familyId)
            .eq("candidate.project_lists.project_id", id)
            .order("list_id")
            .order("person_id")
            .range(from, to),
        )
      : [],
    modules.includes("lists")
      ? allRows((from, to) =>
          client
            .from("project_candidate_votes")
            .select(
              "candidate_id,user_id,vote,candidate:project_list_items!project_candidate_votes_candidate_fkey!inner(project_lists!inner(project_id))",
            )
            .eq("family_id", familyId)
            .eq("candidate.project_lists.project_id", id)
            .order("candidate_id")
            .order("user_id")
            .range(from, to),
        )
      : [],
    modules.includes("lists")
      ? allRows((from, to) =>
          client
            .from("project_photos")
            .select(
              "id,item_id,project_list_items!inner(project_lists!inner(project_id))",
            )
            .eq("family_id", familyId)
            .eq("project_list_items.project_lists.project_id", id)
            .eq("is_ready", true)
            .order("created_at")
            .order("id")
            .range(from, to),
        )
      : [],
    modules.includes("budget")
      ? allRows((from, to) =>
          client
            .from("project_expenses")
            .select("*")
            .eq("family_id", familyId)
            .eq("project_id", id)
            .order("paid_on", { nullsFirst: true })
            .order("planned_on")
            .order("id")
            .range(from, to),
        )
      : [],
  ]);
  throwDatabaseError(members.error);
  return {
    familyId,
    project: parsedProject,
    areas: areaRow.array().parse(areas),
    milestones: milestoneRow.array().parse(milestones),
    tasks: taskRow.array().parse(tasks),
    members: members.data ?? [],
    decisions: decisionRow.array().parse(decisions),
    reservations: reservationRow.array().parse(reservations),
    itinerary: itineraryRow.array().parse(itinerary),
    lists: projectListRow.array().parse(lists),
    listItems: projectListItemRow.array().parse(listItems),
    candidateRecipients: candidateRecipientRow
      .array()
      .parse(candidateRecipients),
    candidateVotes: candidateVoteRow.array().parse(candidateVotes),
    photos: projectPhotoRow.array().parse(photos),
    expenses: expenseRow.array().parse(expenses),
  };
}

function isModuleCommand(
  command: ProjectCommand,
): command is ProjectModuleCommand {
  return projectModuleCommand.safeParse(command).success;
}

function isListCommand(command: ProjectCommand): command is ProjectListCommand {
  return projectListCommand.safeParse(command).success;
}

function isBudgetCommand(
  command: ProjectCommand,
): command is ProjectBudgetCommand {
  return projectBudgetCommand.safeParse(command).success;
}

export async function writeProject(
  raw: unknown,
  createMockEvent: CreateProjectMockEvent,
) {
  const command = projectCommand.parse(raw);
  const mock = await mockContext();
  if (mock) {
    const { members } = await mockJson("family");
    const store = projectMock(mock.values, members);
    if (isBudgetCommand(command))
      return {
        id: writeProjectBudgetMock(
          store,
          command,
          members.map((member) => member.user_id),
        ),
      };
    const actor = members[mock.perspective]!.user_id;
    if (isListCommand(command))
      return { id: writeMockList(store, command, actor) };
    if (isModuleCommand(command))
      return {
        id: await writeProjectModuleMock(
          store,
          command,
          members.filter(
            ({ user_id }) => !mock.values.has(`withdrawn:${user_id}`),
          ),
          actor,
          createMockEvent,
        ),
      };
    return {
      id: writeProjectMock(
        store,
        command,
        actor,
        members.map((member) => member.user_id),
      ),
    };
  }
  const { client } = await projectContext();
  const candidateCommand =
    command.action === "set_candidate_recipient" ||
    command.action === "set_candidate_vote" ||
    command.action === "set_candidate_status" ||
    (command.action === "save_list_item" && command.preserveStatus);
  const rpc = candidateCommand
    ? "write_project_candidate"
    : isBudgetCommand(command)
      ? "write_project_budget"
      : isListCommand(command)
        ? "write_project_list"
        : isModuleCommand(command)
          ? "write_project_module"
          : "write_project";
  const opinionCommand =
    command.action === "save_decision_opinion" ||
    command.action === "set_decision_opinion_reaction";
  const { data, error } = await client.rpc(
    opinionCommand ? "write_project_decision_opinion" : rpc,
    { payload: command },
  );
  if (
    rpc === "write_project_list" &&
    error?.message === "project_columns_in_use" &&
    error.details
  ) {
    throw new ApiError(
      error.message,
      `기존 칸 값을 먼저 수정해 주세요. 해당 항목은 ${error.details}예요.`,
      400,
    );
  }
  throwDatabaseError(error, projectWriteErrors);
  return { id: projectId.parse(data) };
}
