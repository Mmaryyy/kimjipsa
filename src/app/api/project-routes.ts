import "server-only";
import { listEventCategories, saveEvent } from "@/entities/event/index.server";
import { ApiError } from "@/shared/api";
import {
  listProjects,
  readHomeDeadlines,
  readProject,
  readProjectPhoto,
  saveProjectPhoto,
  writeProject,
} from "@/entities/project/index.server";
import { handleRoute, readJson } from "@/shared/server";

export const projectsGET = (request: Request) =>
  handleRoute(request, async () => {
    const params = new URL(request.url).searchParams;
    if (params.has("home-deadlines")) return readHomeDeadlines();
    const id = params.get("id");
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

export const projectPhotosPOST = (request: Request) =>
  handleRoute(request, () => saveProjectPhoto(request));

export async function projectPhotosGET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const photo = await readProjectPhoto(request);
    return new Response(photo, {
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500)
      return new Response(null, { status: error.status, headers });
    return handleRoute(request, () => {
      throw error;
    });
  }
}
