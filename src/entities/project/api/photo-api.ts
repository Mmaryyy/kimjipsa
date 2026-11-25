import { ApiError } from "@/shared/api";
import { compressPhoto } from "@/shared/lib";

const route = "/api/projects/photos";

export function projectPhotoUrl(
  projectId: string,
  id: string,
  thumbnail = false,
) {
  return `${route}?${new URLSearchParams({ projectId, id, size: thumbnail ? "thumb" : "full" })}`;
}

export async function uploadProjectPhoto(
  projectId: string,
  listId: string,
  id: string,
  file: File,
) {
  const [original, thumb] = await Promise.all([
    compressPhoto(file, 2000),
    compressPhoto(file, 320),
  ]);
  const body = new FormData();
  body.set("projectId", projectId);
  body.set("listId", listId);
  body.set("id", id);
  body.set("original", original, "photo.jpg");
  body.set("thumb", thumb, "thumb.jpg");

  const response = await fetch(route, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) {
    throw new ApiError(
      result.error?.code ?? "photo_upload_failed",
      result.error?.message ?? "사진을 올리지 못했어요.",
      response.status,
    );
  }
}
