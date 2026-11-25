import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { listFixtures, removeMockListItems } from "./list-mock.server";
import { moduleFixtures } from "./module-mock.server";
import type {
  ProjectCommand,
  ProjectModuleCommand,
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
} from "./type";

export type ProjectStore = Pick<
  ProjectDetail,
  "lists" | "listItems" | "photos"
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
  const key = "project-store-pj4";
  const existing = values.get(key) as ProjectStore | undefined;
  if (existing) return existing;
  const id = "2fc2341a-62cb-4b1a-8bdc-de35bbd2e0fa";
  const areas = ["신혼여행", "웨딩스냅", "상견례"].map((name, sort_order) => ({
    id: randomUUID(),
    project_id: id,
    name,
    sort_order,
  }));
  const milestones: ProjectMilestone[] = [
    {
      title: "큰 틀 정하기",
      starts_on: "2026-11-01",
      ends_on: "2026-11-30",
      memo: "예산·휴가·전체 일정 확인",
    },
    {
      title: "웨딩스냅",
      starts_on: "2027-02-27",
      ends_on: "2027-03-01",
      memo: "",
    },
    {
      title: "신혼여행",
      starts_on: "2027-04-28",
      ends_on: "2027-05-16",
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
  const taskFixtures: (Partial<ProjectTask> & Pick<ProjectTask, "title">)[] = [
    {
      title: "여행 루트 결정",
      area_id: areas[0].id,
      status: "in_progress",
      starts_on: "2026-11-18",
      due_on: "2026-11-20",
      depends_note: "두 사람 휴가 확인",
      assignee_kind: "together",
    },
    { title: "가족 일정 확인", area_id: areas[2].id, status: "todo" },
    {
      title: "항공권 결제",
      area_id: areas[0].id,
      status: "on_hold",
      due_on: "2027-01-15",
    },
    {
      title: "휴가 확인",
      area_id: areas[0].id,
      status: "done",
      completed_at: "2026-11-18T03:00:00Z",
    },
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
  const store: ProjectStore = {
    projects: [
      {
        id,
        title: "결혼 준비",
        description: "함께 준비하는 우리의 다음 계절",
        status: "active",
        starts_on: "2026-11-18",
        target_on: "2027-04-15",
        modules: ["decisions", "lists", "reservations", "itinerary", "budget"],
      },
      {
        id: randomUUID(),
        title: "이사 준비",
        description: "",
        status: "active",
        starts_on: "2027-06-01",
        target_on: null,
        modules: [],
      },
    ],
    areas,
    milestones,
    tasks,
    ...moduleFixtures(id, areas[0].id, members),
    ...listFixtures(id),
    photoFiles: new Map(),
  };
  values.set(key, store);
  return store;
}

export function writeProjectMock(
  store: ProjectStore,
  command: Exclude<ProjectCommand, ProjectModuleCommand | ProjectListCommand>,
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
    save(store.projects, { ...command.item, id });
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
