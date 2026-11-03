import { z } from "zod";

export const chatVisibilitySchema = z.enum(["shared", "private"]);
export type ChatVisibility = z.infer<typeof chatVisibilitySchema>;
export const searchSourceSchema = z.object({
  title: z.string().max(300),
  url: z
    .url()
    .max(2000)
    .refine((value) => {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    }),
});
export const agentActionSchema = z.object({
  domain: z.enum(["event", "cart", "inventory"]),
  label: z.string().trim().min(1).max(300),
  payload: z.record(z.string(), z.json()),
  expected: z
    .record(z.string(), z.string().regex(/^[a-f0-9]{32}$/))
    .default({}),
});
export type AgentAction = z.infer<typeof agentActionSchema>;
export const actionProposalSchema = z.object({
  id: z.uuid(),
  run_id: z.uuid(),
  actions: z.array(agentActionSchema),
  status: z.enum(["draft", "applied", "cancelled", "expired"]),
  version: z.number().int(),
  expires_at: z.string(),
  result: z
    .array(z.object({ label: z.string() }))
    .nullable()
    .optional(),
});
export type ActionProposal = z.infer<typeof actionProposalSchema>;

export const runStatusLabels = {
  queued: "대기 중",
  running: "처리 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
  unknown: "실행 결과 확인 필요",
} as const;
export const receiptItemSchema = z.object({
  selected: z.boolean().default(true),
  original_name: z.string().max(200).default(""),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().finite().positive(),
  unit_id: z.uuid().nullable(),
  inventory_item_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  location_id: z.uuid().nullable(),
  expires_on: z.iso.date().nullable(),
  reason: z.string().max(500).default(""),
});
export const agentResultSchema = z
  .object({
    kind: z.enum([
      "reply",
      "add",
      "receipt",
      "proposal",
      "summary",
      "actions",
      "action_proposal",
      "search",
      "calendar",
    ]),
    text: z.string().trim().min(1).max(20000),
    requestQuote: z.string().max(10000).default(""),
    items: z.array(receiptItemSchema).max(100).default([]),
    memories: z.array(z.string().trim().min(1).max(2000)).max(20).default([]),
    actions: z.array(agentActionSchema).max(20).default([]),
    query: z.string().trim().max(500).default(""),
    range: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
    sources: z.array(searchSourceSchema).max(5).default([]),
  })
  .refine(
    (result) =>
      !["add", "receipt", "proposal"].includes(result.kind) ||
      result.items.length > 0,
  )
  .refine(
    (result) =>
      !["actions", "action_proposal"].includes(result.kind) ||
      result.actions.length > 0,
  );
export const messageSchema = z.object({
  id: z.uuid(),
  sequence: z.number().int(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  author: z.string(),
  attachment_ids: z.array(z.uuid()),
  created_at: z.string(),
  visibility: chatVisibilitySchema.default("shared"),
  sources: z.array(searchSourceSchema).default([]),
});
export const receiptSchema = z.object({
  id: z.uuid(),
  run_id: z.uuid(),
  kind: z.enum(["receipt", "proposal"]),
  items: z.array(receiptItemSchema),
  status: z.enum(["draft", "applied", "cancelled", "expired"]),
  version: z.number(),
  expires_at: z.string(),
});
export const chatSchema = z.object({
  familyId: z.uuid(),
  name: z.string(),
  workerOnline: z.boolean(),
  nextBefore: z.number().int().positive().safe().nullable(),
  messages: z.array(messageSchema),
  runs: z.array(
    z.object({
      id: z.uuid(),
      input_message_id: z.uuid(),
      status: z.enum(
        Object.keys(runStatusLabels) as [
          keyof typeof runStatusLabels,
          ...Array<keyof typeof runStatusLabels>,
        ],
      ),
      progress: z.string(),
      version: z.number(),
      error_code: z.string().nullable(),
    }),
  ),
  receipts: z.array(receiptSchema),
  proposals: z.array(actionProposalSchema).default([]),
  attachments: z.array(
    z.object({ id: z.uuid(), status: z.string(), expires_at: z.string() }),
  ),
});
export const settingsSchema = z.object({
  name: z.string(),
  memoryEnabled: z.boolean(),
  version: z.number(),
  memoryVersion: z.number(),
  memories: z.array(
    z.object({ id: z.uuid(), text: z.string(), version: z.number() }),
  ),
});
export const sendSchema = z
  .object({
    text: z.string().trim().max(10000),
    attachmentIds: z.array(z.uuid()).max(4),
    clientRequestId: z.uuid(),
    visibility: chatVisibilitySchema.default("shared"),
  })
  .refine((v) => v.text.length > 0 || v.attachmentIds.length > 0);
export const settingsInputSchema = z.object({
  name: z.string().trim().min(1).max(20),
  memoryEnabled: z.boolean(),
});
export const chatErrors: Record<string, string> = {
  state_conflict: "대상이 변경됐어요. 최신 내용을 확인하고 다시 요청해 주세요.",
  event_forbidden: "이 일정을 변경할 권한이 없어요.",
  private_chat_required: "개인 일정은 ‘나만 보기’에서 요청해 주세요.",
  cart_unit_mismatch: "구매 품목과 재고의 단위가 달라요. 단위를 확인해 주세요.",
  cart_duplicate:
    "이미 담긴 품목이 있어요. 수량을 합칠지 따로 담을지 알려 주세요.",
  web_search_unavailable:
    "웹 검색을 완료하지 못했어요. 맥미니의 Hermes 검색 설정을 확인해 주세요.",
  ai_key_missing: "집사 연결 업데이트가 필요해요. 관리자에게 알려 주세요.",
  gateway_auth_required: "맥미니의 AI 로그인을 확인해 주세요.",
  ai_quota_exceeded: "AI 사용 한도를 넘었어요. 잠시 후 다시 요청해 주세요.",
  attachment_expired: "사진 보관 기간이 끝났어요. 다시 첨부해 주세요.",
  lease_expired:
    "연결이 끊겨 실행 결과를 확인해야 해요. 일정·장바구니·재고를 확인한 뒤 다시 요청해 주세요.",
  execution_unknown:
    "실행 결과를 확인하지 못했어요. 변경 대상과 작업 기록을 확인해 주세요.",
  invalid_response: "집사 답변을 읽지 못했어요. 다시 요청해 주세요.",
  model_unavailable: "모델을 사용할 수 없어요. 맥미니 연결을 확인해 주세요.",
};
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type AiSettings = z.infer<typeof settingsSchema>;
