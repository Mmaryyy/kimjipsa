import { z } from "zod";
import { request } from "@/shared/api";
import { chatRoutes } from "@/shared/config";
import {
  chatSchema,
  settingsSchema,
  type ReceiptItem,
  type AgentAction,
} from "../model/chat.schema";
export async function fetchChat(
  before: number | null = null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ visibility: "private" });
  if (before !== null) params.set("before", String(before));
  return chatSchema.parse(
    await request(
      `${chatRoutes.messages}?${params}`,
      undefined,
      undefined,
      signal,
    ),
  );
}
export async function fetchSettings() {
  return settingsSchema.parse(await request(chatRoutes.settings));
}
export function saveSettings(input: unknown) {
  return request(chatRoutes.settings, input);
}
export function writeMemory(input: unknown) {
  return request(chatRoutes.memories, input);
}
export function postChat(input: {
  sessionVersion: number;
  text: string;
  attachmentIds: string[];
  clientRequestId: string;
}) {
  return request(chatRoutes.messages, { ...input, visibility: "private" });
}
export function cancelChat(id: string) {
  return request(chatRoutes.cancelRun(id), {});
}
export function applyReceipt(input: {
  id: string;
  version: number;
  items?: ReceiptItem[];
  cancel?: boolean;
}) {
  return request(chatRoutes.receipt(input.id, input.cancel), input);
}
export async function uploadPhoto(blob: Blob) {
  const upload = z.object({ id: z.uuid(), url: z.url() }).parse(
    await request(chatRoutes.attachments, {
      mimeType: blob.type,
      visibility: "private",
    }),
  );
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!response.ok)
    throw new Error("사진을 올리지 못했어요. 다시 시도해 주세요.");
  await request(chatRoutes.attachment(upload.id), {});
  return upload.id;
}
export async function photoUrl(id: string) {
  return z
    .object({ url: z.url() })
    .parse(await request(chatRoutes.attachment(id)));
}

export function applyActions(input: {
  id: string;
  version: number;
  selected: number[];
  actions?: AgentAction[];
  cancel?: boolean;
}) {
  return request(chatRoutes.actions(input.id), input);
}
