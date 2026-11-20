import "server-only";
import {
  listProjects,
  readProject,
  writeProject,
} from "@/entities/project/index.server";
import { handleRoute, readJson } from "@/shared/server";

export const projectsGET = (request: Request) =>
  handleRoute(request, async () => {
    const id = new URL(request.url).searchParams.get("id");
    return id === null ? listProjects() : readProject(id);
  });
export const projectsPOST = (request: Request) =>
  handleRoute(request, async () => writeProject(await readJson(request)));
