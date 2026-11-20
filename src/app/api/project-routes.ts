import "server-only";
import { listEventCategories, saveEvent } from "@/entities/event/index.server";
import { ApiError } from "@/shared/api";
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
  handleRoute(request, async () =>
    writeProject(await readJson(request), async (item) => {
      const fallback = (await listEventCategories()).find(
        (category) => category.name === "기타",
      );
      if (!fallback)
        throw new ApiError(
          "category_not_found",
          "일정 카테고리를 찾을 수 없어요.",
          404,
        );
      return saveEvent({
        ...item,
        categoryId: fallback.id,
        visibility: "shared",
        isAllDay: true,
        startTime: null,
        endTime: null,
      });
    }),
  );
