import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, type Database, type Json } from "@/shared/api";
import { getSupabaseConfig } from "@/shared/config";
import {
  createServerSupabaseClient,
  throwDatabaseError,
} from "@/shared/server";
import {
  chatSchema,
  receiptItemSchema,
  sendSchema,
  settingsInputSchema,
  settingsSchema,
} from "../model/chat.schema";
import { mockChatPage, mockChatCommand } from "./mock.server";
const errors = {
  confirmation_required: [400, "제안한 변경은 확인 후 실행할 수 있어요."],
  event_forbidden: [403, "이 일정을 변경할 권한이 없어요."],
  private_chat_required: [403, "개인 일정은 ‘나만 보기’에서 요청해 주세요."],
  cart_unit_mismatch: [409, "구매 품목과 재고의 단위가 달라요."],
  cart_duplicate: [
    409,
    "이미 담긴 품목이에요. 수량을 합칠지 따로 담을지 알려 주세요.",
  ],
  invalid_cart: [400, "구매 품목의 수량·단위·보관 장소를 확인해 주세요."],
  event_not_found: [404, "일정을 찾을 수 없어요."],
  invalid_event: [400, "일정의 날짜와 내용을 확인해 주세요."],
  unauthorized: [401, "로그인이 필요해요."],
  forbidden: [403, "권한이 없어요."],
  family_required: [403, "가정에 참여해 주세요."],
  ai_key_missing: [
    503,
    "집사 연결 업데이트가 필요해요. 관리자에게 알려 주세요.",
  ],
  state_conflict: [409, "내용이 바뀌었거나 만료되었어요. 새로고침해 주세요."],
  invalid_inventory: [400, "품목의 수량과 단위를 확인해 주세요."],
  invalid_chat: [400, "입력 내용을 확인해 주세요."],
  attachment_expired: [410, "사진이 만료되었어요. 다시 첨부해 주세요."],
  invalid_attachment: [400, "사진 업로드를 완료해 주세요."],
  not_found: [404, "내용을 찾을 수 없어요."],
  lease_lost: [409, "작업 권한이 만료되었어요."],
} as const;
async function command(operation: string, input: Json = {}) {
  const mock = await mockChatCommand(operation, input);
  if (mock) return mock.data;
  const client = await createServerSupabaseClient();
  const result = await client.rpc("chat_command", { operation, input });
  throwDatabaseError(result.error, errors);
  if (
    result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data) &&
    result.data.chatExpired === true
  )
    throw new ApiError(
      "chat_expired",
      "대화가 만료되었어요. 새 대화에서 다시 요청해 주세요.",
      410,
    );
  return result.data;
}
export async function listChat(
  before: string | null,
  visibility: string | null = "private",
) {
  const cursor =
    before === null
      ? null
      : z.coerce.number().int().positive().safe().parse(before);
  const scope = z.literal("private").parse(visibility ?? "private");
  const mock = await mockChatPage(cursor);
  if (mock) return chatSchema.parse(mock);
  const client = await createServerSupabaseClient();
  const result = await client.rpc("chat_page", {
    input: {
      before: cursor,
      visibility: scope,
    },
  });
  throwDatabaseError(result.error, errors);
  return chatSchema.parse(result.data);
}
export async function confirmActions(id: string, raw: unknown) {
  const input = z
    .object({
      version: z.number().int().positive(),
      cancel: z.boolean().default(false),
      selected: z.array(z.number().int().min(0).max(19)).max(20).default([]),
    })
    .parse(raw);
  return command(input.cancel ? "cancel-actions" : "confirm-actions", {
    ...input,
    id: z.uuid().parse(id),
  });
}
export async function sendChat(raw: unknown) {
  return command("send", sendSchema.parse(raw));
}
export async function cancelRun(id: string) {
  return command("cancel", { id: z.uuid().parse(id) });
}
export async function confirmReceipt(id: string, raw: unknown, cancel = false) {
  const input = z
    .object({
      version: z.number().int().positive(),
      items: z.array(receiptItemSchema).min(1).max(100).optional(),
    })
    .parse(raw);
  if (!cancel && !input.items?.some((item) => item.selected && item.unit_id))
    throw new ApiError("invalid_inventory", "품목과 단위를 선택해 주세요.");
  return command(cancel ? "cancel-receipt" : "confirm", {
    ...input,
    id: z.uuid().parse(id),
  });
}
export async function getAiSettings() {
  return settingsSchema.parse(await command("settings"));
}
export async function saveAiSettings(raw: unknown) {
  return command("save-settings", settingsInputSchema.parse(raw));
}
export async function changeMemory(raw: unknown) {
  const input = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("save-memory"),
        id: z.uuid().optional(),
        version: z.number().int().positive().optional(),
        text: z.string().trim().min(1).max(2000),
      }),
      z.object({
        action: z.literal("delete-memory"),
        id: z.uuid(),
        version: z.number().int().positive(),
      }),
      z.object({ action: z.literal("reset-memories") }),
    ])
    .parse(raw);
  return command(input.action, input);
}
const attachmentSchema = z.object({ id: z.uuid(), path: z.string() });
export async function createAttachment(raw: unknown) {
  const input = z
    .object({
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      visibility: z.literal("private").default("private"),
    })
    .parse(raw);
  const attachment = attachmentSchema.parse(
    await command("attachment-create", input),
  );
  const client = await createServerSupabaseClient();
  const result = await client.storage
    .from("chat-attachments")
    .createSignedUploadUrl(attachment.path);
  if (result.error)
    throw new ApiError(
      "upload_failed",
      "사진 업로드를 준비하지 못했어요.",
      502,
    );
  return { id: attachment.id, url: result.data.signedUrl };
}
export async function completeAttachment(id: string) {
  return command("attachment-ready", { id: z.uuid().parse(id) });
}
export async function readAttachment(id: string) {
  const attachment = attachmentSchema.parse(
    await command("attachment-read", { id: z.uuid().parse(id) }),
  );
  const client = await createServerSupabaseClient();
  const result = await client.storage
    .from("chat-attachments")
    .createSignedUrl(attachment.path, 60);
  if (result.error)
    throw new ApiError("attachment_expired", "사진을 불러오지 못했어요.", 410);
  return { url: result.data.signedUrl };
}
function createAgentClient(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new ApiError("unauthorized", "인증이 필요해요.", 401);
  const { url, key } = getSupabaseConfig();
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function agentReadRequest(request: Request, input: Json) {
  const result = await createAgentClient(request).rpc("agent_read", { input });
  throwDatabaseError(result.error, errors);
  return result.data;
}
export async function agentRequest(
  request: Request,
  operation: string,
  input: Json = {},
) {
  const client = createAgentClient(request);
  const result = await client.rpc("agent_command", { operation, input });
  throwDatabaseError(result.error, errors);
  return result.data;
}
export async function getAgentConfig(request: Request) {
  const data = await agentRequest(request, "config");
  const config = z
    .object({
      workerId: z.uuid(),
      familyId: z.uuid(),
      connectionMode: z.literal("local"),
      capabilitiesVersion: z.number().default(1),
      version: z.number().nullable(),
      memoryVersion: z.number().nullable(),
      name: z.string().nullable(),
      memoryEnabled: z.boolean().nullable(),
    })
    .parse(data);
  return config;
}
