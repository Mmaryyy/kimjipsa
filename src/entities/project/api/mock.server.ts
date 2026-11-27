import "server-only";
import { randomUUID } from "node:crypto";
import { addDays, format, parseISO } from "date-fns";
import { projectToday } from "../model/project-date.utils";
import { ApiError } from "@/shared/api";
import { listFixtures, removeMockListItems } from "./list-mock.server";
import { moduleFixtures } from "./module-mock.server";
import type {
  ProjectCommand,
  ProjectModuleCommand,
  ProjectBudgetCommand,
} from "../model/project.schema";
import type { ProjectListCommand } from "../model/project-list.schema";
import type {
  Project,
  ProjectDetail,
  ProjectArea,
  ProjectMilestone,
  ProjectTask,
  ProjectDecision,
  ProjectReservation,
  ProjectItinerary,
  ProjectMember,
  ProjectExpense,
} from "./type";

export type ProjectStore = Pick<
  ProjectDetail,
  | "lists"
  | "listItems"
  | "photos"
  | "expenses"
  | "candidateRecipients"
  | "candidateVotes"
> & {
  photoFiles: Map<string, [Blob, Blob]>;
  projects: Project[];
  areas: ProjectArea[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  decisions: ProjectDecision[];
  reservations: ProjectReservation[];
  itinerary: ProjectItinerary[];
};

export function projectMock(
  values: Map<string, unknown>,
  members: ProjectMember[],
): ProjectStore {
  const key = "project-store-r029-candidates";
  const existing = values.get(key) as ProjectStore | undefined;
  if (existing) {
    for (const { opinions } of existing.decisions) {
      for (const opinion of opinions) {
        if (opinion.user_id && values.has(`withdrawn:${opinion.user_id}`))
          opinion.user_id = null;
        opinion.reactions = opinion.user_id
          ? opinion.reactions.filter(
              ({ user_id }) => !values.has(`withdrawn:${user_id}`),
            )
          : [];
      }
    }
    existing.candidateVotes = existing.candidateVotes.filter(
      ({ user_id }) => !values.has(`withdrawn:${user_id}`),
    );
    return existing;
  }
  const today = parseISO(projectToday());
  const date = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");
  const id = "2fc2341a-62cb-4b1a-8bdc-de35bbd2e0fa";
  const movingId = randomUUID();
  const areas = ["신혼여행", "웨딩스냅", "상견례", "예식", "신혼집"].map(
    (name, sort_order) => ({
      id: randomUUID(),
      project_id: id,
      name,
      sort_order,
    }),
  );
  const milestones: ProjectMilestone[] = [
    {
      title: "큰 틀 정하기",
      starts_on: date(-25),
      ends_on: date(19),
      memo: "예산·휴가·전체 일정 확인",
    },
    {
      title: "웨딩스냅",
      starts_on: date(93),
      ends_on: date(95),
      memo: "",
    },
    {
      title: "신혼여행",
      starts_on: date(153),
      ends_on: date(171),
      memo: "",
    },
    {
      title: "상견례",
      starts_on: null,
      ends_on: null,
      memo: "3.27 또는 4.03 · 가족 일정 확인 후 결정",
    },
  ].map((row) => ({
    ...row,
    id: randomUUID(),
    project_id: id,
    area_id: null,
    is_tentative: row.starts_on === null,
    event_id: null,
  }));
  const [travel, photos, meeting, ceremony, home] = areas;
  const taskFixtures: (Partial<ProjectTask> & Pick<ProjectTask, "title">)[] = [
    {
      title: "양가 인사 날짜 조율",
      area_id: meeting.id,
      due_on: date(-4),
      assignee_kind: "together",
    },
    {
      title: "여행 루트 결정",
      area_id: travel.id,
      status: "in_progress",
      starts_on: date(-8),
      due_on: date(1),
      assignee_kind: "together",
    },
    {
      title: "예식장 투어 예약",
      area_id: ceremony.id,
      status: "in_progress",
      due_on: date(4),
    },
    {
      title: "예식장 견적 비교표 만들기",
      area_id: ceremony.id,
      due_on: date(7),
    },
    {
      title: "상견례 식당 후보 3곳 찾기",
      area_id: meeting.id,
      due_on: date(9),
    },
    { title: "신혼집 대출 상담", area_id: home.id, due_on: date(14) },
    {
      title: "항공권 결제",
      area_id: travel.id,
      status: "on_hold",
      due_on: date(50),
      depends_note: "여행 루트 결정 뒤",
    },
    {
      title: "스냅 촬영 의상 정하기",
      area_id: photos.id,
      due_on: date(67),
      assignee_kind: "together",
    },
    { title: "청첩장 문구 정하기", area_id: ceremony.id, due_on: date(76) },
    { title: "가족 일정 확인", area_id: meeting.id },
    { title: "가전 목록 정리", area_id: home.id },
    {
      title: "이사 날짜 정하기",
      area_id: home.id,
      status: "on_hold",
      depends_note: "대출 상담 결과 보고",
    },
    {
      title: "휴가 확인",
      area_id: travel.id,
      status: "done",
      due_on: date(-6),
      completed_at: `${date(-7)}T03:00:00Z`,
    },
    {
      title: "스냅 작가 포트폴리오 보기",
      area_id: photos.id,
      status: "done",
      completed_at: `${date(-14)}T03:00:00Z`,
    },
    {
      title: "스냅 작가 계약금 송금",
      area_id: photos.id,
      status: "done",
      completed_at: `${date(-12)}T03:00:00Z`,
    },
    {
      title: "예물 매장 방문",
      area_id: ceremony.id,
      status: "done",
      completed_at: `${date(-3)}T03:00:00Z`,
    },
    ...[
      "이사 업체 견적 받기",
      "안 쓰는 물건 나누기",
      "포장 상자 준비",
      "주소 변경할 곳 정리",
    ].map((title) => ({
      title,
      project_id: movingId,
    })),
  ];
  const tasks: ProjectTask[] = taskFixtures.map((row) => ({
    id: randomUUID(),
    project_id: id,
    area_id: null,
    assignee_kind: "unassigned",
    assignee_id: null,
    status: "todo",
    starts_on: null,
    due_on: null,
    depends_note: "",
    memo: "",
    completed_by: null,
    completed_at: null,
    ...row,
  }));
  const expenseFixtures: (Partial<ProjectExpense> &
    Pick<ProjectExpense, "title">)[] = [
    {
      title: "예식장 계약금",
      area_id: ceremony.id,
      estimated_amount: 2_000_000,
      planned_on: "2026-11-20",
      actual_amount: 2_000_000,
      paid_on: "2026-11-20",
      payer_id: members[0]?.user_id ?? null,
    },
    {
      title: "스냅 계약금",
      area_id: photos.id,
      estimated_amount: 300_000,
      planned_on: "2026-11-14",
      actual_amount: 300_000,
      paid_on: "2026-11-14",
      payer_id: members[0]?.user_id ?? null,
    },
    {
      title: "예물",
      area_id: ceremony.id,
      estimated_amount: 3_500_000,
      planned_on: "2026-11-23",
      actual_amount: 3_200_000,
      paid_on: "2026-11-23",
      payer_id: (members[1] ?? members[0])?.user_id ?? null,
    },
    {
      title: "파리 숙소 선금",
      estimated_amount: 600_000,
      planned_on: "2026-10-30",
      actual_amount: 600_000,
      paid_on: "2026-10-30",
    },
    {
      title: "파리 → 로마 기차",
      estimated_amount: 312_000,
      planned_on: date(7),
    },
    { title: "항공권", estimated_amount: 2_400_000, planned_on: date(50) },
    {
      title: "예식장 중도금",
      area_id: ceremony.id,
      estimated_amount: 6_000_000,
      planned_on: date(81),
    },
    {
      title: "청첩장",
      area_id: ceremony.id,
      estimated_amount: 250_000,
      planned_on: date(-4),
    },
    {
      title: "한복 대여",
      area_id: ceremony.id,
      estimated_amount: 600_000,
      planned_on: date(114),
    },
  ];
  const store: ProjectStore = {
    projects: [
      {
        id,
        title: "결혼 준비",
        description: "함께 준비하는 우리의 다음 계절",
        status: "active",
        starts_on: date(-25),
        target_on: date(161),
        modules: ["decisions", "lists", "reservations", "itinerary", "budget"],
        budget_limit: 30_000_000,
      },
      {
        id: movingId,
        title: "이사 준비",
        description: "",
        status: "active",
        starts_on: date(187),
        target_on: null,
        modules: [],
        budget_limit: null,
      },
    ],
    areas,
    milestones,
    tasks,
    ...moduleFixtures(
      id,
      { travel: travel.id, photos: photos.id, meeting: meeting.id },
      members,
      date,
    ),
    ...listFixtures(id, members),
    expenses: expenseFixtures.map((row) => ({
      id: randomUUID(),
      project_id: id,
      area_id: travel.id,
      estimated_amount: null,
      planned_on: null,
      actual_amount: null,
      paid_on: null,
      payer_id: null,
      links: [],
      memo: "",
      ...row,
    })),
  };
  values.set(key, store);
  return store;
}

export function writeProjectMock(
  store: ProjectStore,
  command: Exclude<
    ProjectCommand,
    ProjectModuleCommand | ProjectListCommand | ProjectBudgetCommand
  >,
  actor: string,
  members: string[],
) {
  const targetId = "id" in command ? command.id : undefined;
  const id = targetId ?? randomUUID();
  const missing = () =>
    new ApiError("project_not_found", "프로젝트 항목을 찾을 수 없어요.", 404);
  function save<T extends { id: string }>(rows: T[], row: T) {
    const index = rows.findIndex((entry) => entry.id === id);
    if (targetId && index === -1) throw missing();
    if (index === -1) rows.push(row);
    else rows[index] = row;
  }
  function remove<T extends { id: string }>(rows: T[]) {
    const index = rows.findIndex((entry) => entry.id === id);
    if (index === -1) throw missing();
    rows.splice(index, 1);
  }
  if (command.action === "save_project") {
    const budget_limit =
      store.projects.find((row) => row.id === id)?.budget_limit ?? null;
    save(store.projects, { ...command.item, id, budget_limit });
    return id;
  }
  if (command.action === "delete_project") {
    remove(store.projects);
    const removedLists = new Set(
      store.lists
        .filter((list) => list.project_id === id)
        .map((list) => list.id),
    );
    store.lists = store.lists.filter((list) => !removedLists.has(list.id));
    removeMockListItems(
      store,
      new Set(
        store.listItems
          .filter((item) => removedLists.has(item.list_id))
          .map((item) => item.id),
      ),
    );
    store.areas = store.areas.filter((row) => row.project_id !== id);
    store.milestones = store.milestones.filter((row) => row.project_id !== id);
    store.tasks = store.tasks.filter((row) => row.project_id !== id);
    store.decisions = store.decisions.filter((row) => row.project_id !== id);
    store.reservations = store.reservations.filter(
      (row) => row.project_id !== id,
    );
    store.itinerary = store.itinerary.filter((row) => row.project_id !== id);
    store.expenses = store.expenses.filter((row) => row.project_id !== id);
    return id;
  }
  const project_id = command.projectId;
  if (!store.projects.some((row) => row.id === project_id)) throw missing();
  if ("item" in command && "area_id" in command.item) {
    const areaId = command.item.area_id;
    if (
      areaId &&
      !store.areas.some(
        (row) => row.id === areaId && row.project_id === project_id,
      )
    )
      throw new ApiError("invalid_project", "영역을 다시 선택해 주세요.");
  }
  if (command.action === "reorder_areas") {
    const areas = store.areas.filter((row) => row.project_id === project_id);
    const order = new Map(
      command.areaIds.map((areaId, index) => [areaId, index]),
    );
    if (
      command.areaIds.length !== areas.length ||
      areas.some((area) => !order.has(area.id))
    ) {
      throw new ApiError("invalid_project", "영역 목록을 다시 확인해 주세요.");
    }
    for (const area of areas) area.sort_order = order.get(area.id)!;
    return project_id;
  }
  if (targetId) {
    const rows = command.action.endsWith("_area")
      ? store.areas
      : command.action.endsWith("_milestone")
        ? store.milestones
        : store.tasks;
    if (!rows.some((row) => row.id === id && row.project_id === project_id))
      throw missing();
  }
  switch (command.action) {
    case "save_area": {
      const current = store.areas.find((row) => row.id === id);
      const lastOrder = store.areas
        .filter((row) => row.project_id === project_id)
        .reduce((max, row) => Math.max(max, row.sort_order), 0);
      const sort_order =
        command.item.sort_order ??
        current?.sort_order ??
        Math.min(2147483647, lastOrder + 1);
      save(store.areas, {
        name: command.item.name,
        sort_order,
        id,
        project_id,
      });
      break;
    }
    case "delete_area":
      remove(store.areas);
      for (const row of [
        ...store.milestones,
        ...store.tasks,
        ...store.reservations,
        ...store.expenses,
      ]) {
        if (row.area_id === id) row.area_id = null;
      }
      break;
    case "save_milestone": {
      const previous = store.milestones.find((row) => row.id === id);
      if (previous) Object.assign(previous, command.item);
      else
        save(store.milestones, {
          ...command.item,
          id,
          project_id,
          event_id: null,
        });
      break;
    }
    case "delete_milestone":
      remove(store.milestones);
      break;
    case "save_task": {
      const item = command.item;
      if (item.assignee_id && !members.includes(item.assignee_id))
        throw new ApiError("invalid_project", "담당자를 다시 선택해 주세요.");
      const previous = store.tasks.find((row) => row.id === id);
      const done = item.status === "done";
      save(store.tasks, {
        ...item,
        id,
        project_id,
        completed_at: done
          ? (previous?.completed_at ?? new Date().toISOString())
          : null,
        completed_by: done
          ? previous?.completed_at
            ? previous.completed_by
            : actor
          : null,
      });
      break;
    }
    case "set_task_done": {
      const row = store.tasks.find((task) => task.id === id);
      if (!row) throw missing();
      if (command.done && row.status !== "done") {
        row.status = "done";
        row.completed_at = new Date().toISOString();
        row.completed_by = actor;
      } else if (!command.done && row.status === "done") {
        row.status = "todo";
        row.completed_at = null;
        row.completed_by = null;
      }
      break;
    }
    case "delete_task":
      remove(store.tasks);
      break;
  }
  return id;
}

export function writeProjectBudgetMock(
  store: ProjectStore,
  command: ProjectBudgetCommand,
  members: string[],
) {
  const project_id = command.projectId;
  const project = store.projects.find((row) => row.id === project_id);
  const missing = () =>
    new ApiError("project_not_found", "프로젝트 항목을 찾을 수 없어요.", 404);
  if (!project?.modules.includes("budget")) throw missing();

  if (command.action === "set_budget_limit") {
    project.budget_limit = command.budget_limit;
    return project_id;
  }
  const index = store.expenses.findIndex(
    (row) => row.id === command.id && row.project_id === project_id,
  );
  if (command.id && index === -1) throw missing();
  if (command.action === "delete_expense") {
    store.expenses.splice(index, 1);
    return command.id;
  }

  const { item, budget_limit } = command;
  const previous = store.expenses[index];
  const payerMissing =
    previous?.payer_id === null && previous.actual_amount !== null;
  if (item.actual_amount !== null && item.payer_id === null && !payerMissing)
    throw new ApiError("invalid_project", "결제자를 선택해 주세요.");
  if (
    (item.payer_id && !members.includes(item.payer_id)) ||
    (item.area_id &&
      !store.areas.some(
        (area) => area.id === item.area_id && area.project_id === project_id,
      ))
  )
    throw new ApiError(
      "invalid_project",
      "영역과 결제자를 다시 확인해 주세요.",
    );

  const id = command.id ?? randomUUID();
  const row = { ...item, id, project_id };
  if (index === -1) store.expenses.push(row);
  else store.expenses[index] = row;
  if (budget_limit !== undefined) project.budget_limit = budget_limit;
  return id;
}
