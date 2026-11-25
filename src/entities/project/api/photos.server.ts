import "server-only";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import { mockContext, mockJson, throwDatabaseError } from "@/shared/server";
import { projectContext, projectWriteErrors } from "./server";
import {
  projectListNotFound,
  readMockLists,
  saveMockListPhoto,
} from "./list-mock.server";
import { projectMock } from "./mock.server";

const bucket = "project-photos";
const uploadTarget = z.object({
  projectId: z.uuid(),
  listId: z.uuid(),
  id: z.uuid(),
});
const fileLimit = 1048576;

async function jpeg(value: FormDataEntryValue | null) {
  const invalid = () =>
    new ApiError("invalid_photo", "1MB 이하 JPEG 사진을 선택해 주세요.");
  if (
    !(value instanceof Blob) ||
    value.type !== "image/jpeg" ||
    value.size > fileLimit ||
    value.size < 4
  )
    throw invalid();
  const [first, second, third] = new Uint8Array(
    await value.slice(0, 3).arrayBuffer(),
  );
  if (first !== 0xff || second !== 0xd8 || third !== 0xff) throw invalid();
  return value;
}

async function photoForm(request: Request) {
  const maxSize = 2 * fileLimit + 8192;
  const tooLarge = () =>
    new ApiError("invalid_photo", "사진 용량을 확인해 주세요.", 413);
  if (Number(request.headers.get("content-length")) > maxSize) throw tooLarge();
  const contentType = request.headers.get("content-type");
  if (!request.body || !contentType?.startsWith("multipart/form-data;"))
    throw new ApiError("invalid_photo", "사진을 읽지 못했어요.");

  let bytes = 0;
  const stream = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > maxSize) throw tooLarge();
        controller.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Response(stream, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    if (bytes > maxSize) throw tooLarge();
    throw new ApiError("invalid_photo", "사진을 읽지 못했어요.");
  }
}

export async function saveProjectPhoto(request: Request) {
  const mock = await mockContext();
  const context = mock ? null : await projectContext();
  const data = await photoForm(request);
  const target = uploadTarget.parse({
    projectId: data.get("projectId"),
    listId: data.get("listId"),
    id: data.get("id"),
  });
  const original = await jpeg(data.get("original"));
  const thumb = await jpeg(data.get("thumb"));

  if (mock) {
    const { members } = await mockJson("family");
    const store = projectMock(mock.values, members);
    return {
      id: saveMockListPhoto(store, target.projectId, target.listId, target.id, [
        original,
        thumb,
      ]),
    };
  }

  if (!context) throw projectListNotFound();
  const { client, familyId } = context;
  const reservation = await client.rpc("write_project_list", {
    payload: { ...target, action: "reserve_list_photo" },
  });
  throwDatabaseError(reservation.error, projectWriteErrors);
  const id = z.uuid().parse(reservation.data);
  const storage = client.storage.from(bucket);
  const base = `${familyId}/${target.id}/${id}`;
  try {
    const uploads = await Promise.allSettled([
      storage.upload(`${base}.jpg`, original, { contentType: "image/jpeg" }),
      storage.upload(`${base}-thumb.jpg`, thumb, { contentType: "image/jpeg" }),
    ]);
    if (
      uploads.some(
        (upload) => upload.status === "rejected" || upload.value.error,
      )
    ) {
      const [status, message] = projectWriteErrors.photo_upload_failed;
      throw new ApiError("photo_upload_failed", message, status);
    }
    const finalized = await client.rpc("write_project_list", {
      payload: { ...target, action: "finalize_list_photo", photoId: id },
    });
    throwDatabaseError(finalized.error, projectWriteErrors);
  } catch (error) {
    const removed = await client.rpc("write_project_list", {
      payload: { ...target, action: "cancel_list_photo", photoId: id },
    });
    if (removed.error?.message !== "project_not_found")
      throwDatabaseError(removed.error, projectWriteErrors);
    throw error;
  }
  return { id };
}

export async function readProjectPhoto(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const parsed = z.object({ projectId: z.uuid(), id: z.uuid() }).safeParse({
    projectId: parameters.get("projectId"),
    id: parameters.get("id"),
  });
  if (!parsed.success) throw projectListNotFound();
  const { id, projectId } = parsed.data;
  const thumbnail = parameters.get("size") === "thumb";
  const mock = await mockContext();
  if (mock) {
    const { members } = await mockJson("family");
    const store = projectMock(mock.values, members);
    if (
      !readMockLists(store, projectId).photos.some((photo) => photo.id === id)
    )
      throw projectListNotFound();
    const blob = store.photoFiles.get(id)?.[thumbnail ? 1 : 0];
    if (!blob) throw projectListNotFound();
    return blob;
  }

  const { client, familyId } = await projectContext();
  const photo = await client
    .from("project_photos")
    .select(
      "storage_path,thumb_path,project_list_items!inner(project_lists!inner(project_id))",
    )
    .eq("id", id)
    .eq("family_id", familyId)
    .eq("is_ready", true)
    .eq("project_list_items.project_lists.project_id", projectId)
    .maybeSingle();
  throwDatabaseError(photo.error);
  if (!photo.data) throw projectListNotFound();
  const download = await client.storage
    .from(bucket)
    .download(thumbnail ? photo.data.thumb_path : photo.data.storage_path);
  if (download.error || !download.data) throw projectListNotFound();
  return download.data;
}
