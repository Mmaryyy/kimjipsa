import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { mockContext, mockJson } from "@/shared/server";
import type { Chat, AiSettings, AgentAction } from "../model/chat.schema";

interface MockChatState {
  chat: Chat;
  settings: AiSettings;
  retryRequests: Map<string, { messageId: string; runId: string }>;
}

async function mockState() {
  const context = await mockContext();
  if (!context) return null;
  const family = await mockJson("family");
  const key = `chat:private:${context.perspective}`;
  let state = context.values.get(key) as MockChatState | undefined;
  if (!state) {
    const created_at = new Date().toISOString();
    const message = (
      role: "user" | "assistant",
      text: string,
      sequence: number,
      awaiting_answer = false,
    ) => ({
      id: randomUUID(),
      role,
      text,
      sequence,
      created_at,
      visibility: "private" as const,
      author:
        role === "assistant"
          ? "김집사"
          : family.members[context.perspective]!.display_name,
      attachment_ids: [],
      sources: [],
      choices: [],
      awaiting_answer,
    });
    const messages: Chat["messages"] = [
      message("user", "이번 주 토요일에 뭐 있어?", 1),
      message(
        "assistant",
        "토요일 일정이에요.\n12:00 부모님 댁 점심 · 분당\n15:00 이케아 가구 보기 · 광명점\n15:00 가족 산책 · 공유\n다른 구성원의 개인 일정은 시간만 보여드려요.",
        2,
      ),
      message(
        "user",
        "11월 7일 오후 3시 치과 일정과 우유 장바구니를 등록해줘",
        3,
      ),
      message("user", "새 일정도 등록할게", 4),
      message("assistant", "새 일정의 제목은 무엇인가요?", 5, true),
    ];
    messages.push({
      ...message("assistant", "새 일정은 누구에게 보여 드릴까요?", 6),
      awaiting_answer: true,
      choices: [
        { label: "공유 일정", value: "shared" },
        { label: "개인 일정", value: "private" },
      ],
    });
    const runId = randomUUID();
    const settings = (context.values.get("chat:settings") as
      AiSettings | undefined) ?? {
      name: "집사",
      memoryEnabled: true,
      version: 1,
      memoryVersion: 1,
      memories: [],
    };
    context.values.set("chat:settings", settings);
    state = {
      settings,
      retryRequests: new Map(),
      chat: {
        sessionVersion: 1,
        expiresAt: new Date(Date.parse(created_at) + 3600000).toISOString(),
        familyId: family.id,
        name: "집사",
        workerOnline: true,
        nextBefore: null,
        messages,
        attachments: [],
        receipts: [],
        runs: [
          {
            id: runId,
            input_message_id: messages[2].id,
            created_at,
            status: "completed",
            progress: "",
            version: 1,
            error_code: null,
          },
        ],
        proposals: [
          {
            id: randomUUID(),
            run_id: runId,
            actions: [
              {
                domain: "event",
                label: "11월 7일 15:00 치과 개인 일정 추가 (병원)",
                payload: {
                  id: null,
                  occurrenceDate: null,
                  event: {
                    title: "치과",
                    place: "",
                    memo: "",
                    categoryId: "10000000-0000-4000-8000-000000000012",
                    visibility: "private",
                    startDate: "2026-11-07",
                    endDate: "2026-11-07",
                    startTime: "15:00",
                    endTime: null,
                    isAllDay: false,
                    remindBefore: 30,
                    kind: "event",
                    ddayStyle: "normal",
                    celebrateMessage: "",
                    recurrence: null,
                  },
                },
                expected: {},
              },
              {
                domain: "cart",
                label: "우유 1개 장바구니 담기",
                payload: {
                  action: "add",
                  item: {
                    name: "우유",
                    quantity: 1,
                    unit_id: "863a0860-2cfb-4361-8067-727ee92c58ea",
                    category_id: null,
                    memo: "",
                    link_url: "",
                    inventory_item_id: null,
                  },
                  duplicate: "separate",
                },
                expected: {},
              },
            ],
            status: "draft",
            version: 1,
            expires_at: "infinity",
          },
        ],
      },
    };
    context.values.set(key, state);
  }
  if (
    !state.chat.proposals.some((p) => p.status === "draft") &&
    state.chat.expiresAt &&
    Date.parse(state.chat.expiresAt) <= Date.now()
  ) {
    state.chat.sessionVersion++;
    state.chat.expiresAt = null;
    state.chat.messages = [];
    state.chat.runs = [];
    state.retryRequests.clear();
    state.chat.proposals = [];
    state.chat.receipts = [];
    state.chat.attachments = [];
  }
  return { state, context, family };
}

export async function mockChatPage(before: number | null) {
  const mock = await mockState();
  if (!mock) return null;
  return {
    ...mock.state.chat,
    runs: [
      ...new Map(
        mock.state.chat.runs.map((run) => [run.input_message_id, run]),
      ).values(),
    ],
    name: mock.state.settings.name,
    expiresAt: mock.state.chat.proposals.some((p) => p.status === "draft")
      ? null
      : mock.state.chat.expiresAt,
    messages: mock.state.chat.messages.filter(
      (message) => before === null || message.sequence < before,
    ),
  };
}

export async function mockChatCommand(operation: string, raw: unknown) {
  const context = await mockContext();
  if (!context) return null;
  // Inputs have already passed the same schemas as real requests.
  const input = raw as Record<string, unknown>;
  const previous = context.values.get(`chat:private:${context.perspective}`) as
    MockChatState | undefined;
  const expired =
    previous?.chat.expiresAt &&
    Date.parse(previous.chat.expiresAt) <= Date.now() &&
    !previous.chat.proposals.some((proposal) => proposal.status === "draft");
  const mock = (await mockState())!;
  if (operation === "retry" && expired)
    throw new ApiError(
      "chat_expired",
      "대화가 만료되었어요. 다시 요청해 주세요.",
      410,
    );
  const { state } = mock;
  if (operation === "settings") return { data: state.settings };
  if (operation === "save-settings") {
    state.settings.name = input.name as string;
    state.settings.memoryEnabled = input.memoryEnabled as boolean;
    state.settings.version++;
    return { data: null };
  }
  if (operation === "send") {
    if (input.sessionVersion !== state.chat.sessionVersion)
      throw new ApiError(
        "state_conflict",
        "대화가 만료되었어요. 다시 요청해 주세요.",
        409,
      );
    const created_at = new Date().toISOString();
    state.chat.expiresAt = new Date(
      Date.parse(created_at) + 3600000,
    ).toISOString();
    const id = randomUUID();
    state.chat.messages.push({
      id,
      sequence: (state.chat.messages.at(-1)?.sequence ?? 0) + 1,
      role: "user",
      text: input.text as string,
      author: mock.family.members[context.perspective]!.display_name,
      created_at,
      attachment_ids: input.attachmentIds as string[],
      visibility: "private",
      sources: [],
      choices: [],
      awaiting_answer: false,
    });
    state.chat.runs.push({
      id: randomUUID(),
      input_message_id: id,
      created_at,
      status: "queued",
      progress: "",
      version: 1,
      error_code: null,
    });
    return { data: { id } };
  }
  if (
    ["confirm-actions", "cancel-actions", "edit-actions"].includes(operation)
  ) {
    const proposal = state.chat.proposals.find(
      (entry) => entry.id === input.id,
    );
    if (
      !proposal ||
      proposal.status !== "draft" ||
      proposal.version !== input.version
    )
      throw new ApiError(
        "state_conflict",
        "내용이 바뀌었거나 만료되었어요.",
        409,
      );
    if (operation === "edit-actions") {
      const updated = input.actions as AgentAction[];
      if (
        updated.length !== proposal.actions.length ||
        updated.some(
          (a, i) =>
            a.domain !== proposal.actions[i].domain ||
            a.payload.id !== proposal.actions[i].payload.id ||
            a.payload.action !== proposal.actions[i].payload.action ||
            JSON.stringify(a.expected) !==
              JSON.stringify(proposal.actions[i].expected),
        )
      )
        throw new ApiError("invalid_chat", "변경 내용을 확인해 주세요.");
      const categories = await mockJson("event-categories");
      proposal.actions = updated.map((a) => {
        const nominal = updated.length > 1;
        const e = a.payload.event;
        const item = a.payload.item;
        let label = a.label;
        if (e && typeof e === "object" && !Array.isArray(e)) {
          const date = String(e.startDate);
          const day = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
          const time = e.isAllDay ? "종일" : (e.startTime ?? "시간 미정");
          const visibility =
            e.visibility === "shared" ? "공유 일정" : "개인 일정";
          const category = categories.find((c) => c.id === e.categoryId)?.name;
          const verb = a.payload.id ? "수정" : "추가";
          const target = `${category} 카테고리의 ${visibility}${a.payload.id ? "을" : "으로"}`;
          label = nominal
            ? `${day} ${time} ${e.title} ${visibility} ${verb} (${category})`
            : `${day} ${time}, ${e.title}, ${target} ${verb}할까요?`;
        }
        if (item && typeof item === "object" && !Array.isArray(item))
          label = nominal
            ? `${item.name} ${item.quantity}개 장바구니 담기`
            : `${item.name} ${item.quantity}개 장바구니에 담을까요?`;
        return { ...a, label };
      });
      proposal.version++;
      return { data: null };
    }
    if (operation === "confirm-actions" && !(input.selected as number[]).length)
      throw new ApiError("invalid_chat", "반영할 항목을 선택해 주세요.");
    proposal.status = operation === "cancel-actions" ? "cancelled" : "applied";
    proposal.result = proposal.actions
      .filter((_, index) => (input.selected as number[]).includes(index))
      .map(({ label }) => ({
        label: label
          .replace(/ 추가 \(.+\)$/, "을 추가했어요")
          .replace(/ 수정 \(.+\)$/, "을 수정했어요")
          .replace(/ 장바구니 담기$/, " 장바구니에 담았어요")
          .replace(/추가할까요\?$/, "추가했어요")
          .replace(/수정할까요\?$/, "수정했어요")
          .replace(/담을까요\?$/, "담았어요"),
      }));
    proposal.actions = proposal.actions.filter((_, index) =>
      (input.selected as number[]).includes(index),
    );
    const created_at = new Date().toISOString();
    const text =
      operation === "cancel-actions"
        ? "취소했어요"
        : proposal.result.map(({ label }) => label).join("\n");
    if (operation !== "cancel-actions")
      state.chat.messages.push({
        id: randomUUID(),
        sequence: (state.chat.messages.at(-1)?.sequence ?? 0) + 1,
        role: "assistant",
        text,
        author: "김집사",
        attachment_ids: [],
        created_at,
        visibility: "private",
        sources: [],
        choices: [],
      });
    if (operation === "cancel-actions") proposal.actions = [];
    state.chat.expiresAt = new Date(
      Date.parse(created_at) + 3600000,
    ).toISOString();
    proposal.version++;
    return { data: null };
  }
  if (operation === "retry") {
    const run = state.chat.runs.find((entry) => entry.id === input.id);
    const message = state.chat.messages.find(
      (entry) => entry.id === run?.input_message_id,
    );
    if (!run || !message || message.role !== "user")
      throw new ApiError("forbidden", "권한이 없어요.", 403);
    const requestId = input.clientRequestId as string;
    const duplicate = state.retryRequests.get(requestId);
    if (duplicate) {
      if (duplicate.messageId !== message.id)
        throw new ApiError(
          "state_conflict",
          "내용이 바뀌었거나 만료되었어요.",
          409,
        );
      return { data: { id: duplicate.runId } };
    }
    const latest = state.chat.runs.findLast(
      (entry) => entry.input_message_id === message.id,
    );
    if (
      state.chat.messages.findLast((entry) => entry.role === "user")?.id !==
        message.id ||
      latest?.id !== run.id ||
      !["failed", "cancelled", "unknown"].includes(run.status) ||
      state.chat.runs.some(
        (entry) =>
          entry.input_message_id === message.id &&
          ["queued", "running"].includes(entry.status),
      )
    )
      throw new ApiError(
        "state_conflict",
        "내용이 바뀌었거나 만료되었어요.",
        409,
      );
    if (
      message.attachment_ids.some(
        (id) =>
          !state.chat.attachments.some(
            (attachment) =>
              attachment.id === id &&
              attachment.status === "ready" &&
              Date.parse(attachment.expires_at) > Date.now(),
          ),
      )
    )
      throw new ApiError(
        "attachment_expired",
        "사진이 만료되었어요. 다시 첨부해 주세요.",
        410,
      );
    const id = randomUUID();
    const created_at = new Date().toISOString();
    state.chat.expiresAt = new Date(
      Date.parse(created_at) + 3600000,
    ).toISOString();
    state.chat.runs.push({
      id,
      input_message_id: message.id,
      created_at,
      status: "queued",
      progress: "",
      version: 1,
      error_code: null,
    });
    state.retryRequests.set(requestId, { messageId: message.id, runId: id });
    return { data: { id } };
  }
  if (operation === "cancel") {
    const run = state.chat.runs.find((entry) => entry.id === input.id);
    if (run) run.status = "cancelled";
    return { data: null };
  }
  throw new ApiError(
    "mock_unsupported",
    "이 동작은 실제 연결에서 사용할 수 있어요.",
    400,
  );
}
