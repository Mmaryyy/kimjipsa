import "server-only";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import {
  projectCommand,
  projectId,
  taskStatuses,
} from "../model/project.schema";
import { projectProgress, upcomingTasks } from "../model/progress.utils";
import { projectToday } from "../model/project-date.utils";
import { projectMock, writeProjectMock } from "./mock.server";
import {
  areaRow,
  milestoneRow,
  projectRow,
  taskRow,
  type ProjectDetail,
  type ProjectList,
} from "./type";

const errors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  project_not_found: [404, "프로젝트 항목을 찾을 수 없어요."],
  invalid_project: [400, "프로젝트 항목의 입력을 확인해 주세요."],
} as const;

async function projectContext() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", errors.unauthorized[1], 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error);
  if (!membership.data)
    throw new ApiError("family_required", errors.family_required[1], 403);
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
  const { projects, tasks, familyId } = mock
    ? { ...projectMock(mock.values), familyId: (await mockJson("family")).id }
    : await readList();
  const byProject = Map.groupBy(tasks, (task) => task.project_id);
  const today = projectToday();
  return {
    familyId,
    entries: projects.map((project) => {
      const items = byProject.get(project.id) ?? [];
      const next = upcomingTasks(items, today)[0];
      return {
        project,
        progress: projectProgress(items),
        next: next && { title: next.title, due_on: next.due_on },
      };
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

export async function readProject(rawId: string): Promise<ProjectDetail> {
  const id = projectId.parse(rawId);
  const mock = await mockContext();
  if (mock) {
    const family = await mockJson("family");
    const store = projectMock(mock.values);
    const project = store.projects.find((row) => row.id === id);
    if (!project)
      throw new ApiError("project_not_found", errors.project_not_found[1], 404);
    return {
      familyId: family.id,
      project,
      areas: store.areas
        .filter((row) => row.project_id === id)
        .sort((a, b) => a.sort_order - b.sort_order),
      milestones: store.milestones.filter((row) => row.project_id === id),
      tasks: store.tasks.filter((row) => row.project_id === id),
      members: family.members,
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
    throw new ApiError("project_not_found", errors.project_not_found[1], 404);
  const [areas, milestones, tasks, members] = await Promise.all([
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
  ]);
  throwDatabaseError(members.error);
  return {
    familyId,
    project: projectRow.parse(project.data),
    areas: areaRow.array().parse(areas),
    milestones: milestoneRow.array().parse(milestones),
    tasks: taskRow.array().parse(tasks),
    members: members.data ?? [],
  };
}

export async function writeProject(raw: unknown) {
  const command = projectCommand.parse(raw);
  const mock = await mockContext();
  if (mock) {
    const { members } = await mockJson("family");
    const actor = members[mock.perspective]!.user_id;
    return {
      id: writeProjectMock(
        projectMock(mock.values),
        command,
        actor,
        members.map((member) => member.user_id),
      ),
    };
  }
  const { client } = await projectContext();
  const { data, error } = await client.rpc("write_project", {
    payload: command,
  });
  throwDatabaseError(error, errors);
  return { id: projectId.parse(data) };
}
