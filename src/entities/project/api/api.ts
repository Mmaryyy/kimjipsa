import { request } from "@/shared/api";
import type { ProjectCommand } from "../model/project.schema";
import type { ProjectDetail, ProjectList } from "./type";

const route = "/api/projects";
export const fetchProjects = (signal?: AbortSignal) =>
  request<ProjectList>(route, undefined, undefined, signal);
export const fetchProject = (id: string, signal?: AbortSignal) =>
  request<ProjectDetail>(
    `${route}?id=${encodeURIComponent(id)}`,
    undefined,
    undefined,
    signal,
  );
export const writeProject = (command: ProjectCommand) =>
  request<{ id: string }>(route, command);
