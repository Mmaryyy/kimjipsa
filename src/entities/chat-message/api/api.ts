import { z } from "zod";
import { request } from "@/shared/api";
import { chatRoutes } from "@/shared/config";
import {
  chatSchema,
  settingsSchema,
  type ReceiptItem,
} from "../model/chat.schema";
export async function fetchChat() {
  let chat = chatSchema.parse(await request(chatRoutes.messages));
  while (chat.messages.length && chat.messages.length % 100 === 0) {
    const next = chatSchema.parse(
      await request(
        `${chatRoutes.messages}?after=${chat.messages.at(-1)!.sequence}`,
      ),
    );
    chat = { ...next, messages: [...chat.messages, ...next.messages] };
    if (next.messages.length < 100) break;
  }
  return chat;
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
  text: string;
  attachmentIds: string[];
  clientRequestId: string;
}) {
  return request(chatRoutes.messages, input);
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
  const upload = z
    .object({ id: z.uuid(), url: z.url() })
    .parse(await request(chatRoutes.attachments, { mimeType: blob.type }));
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
