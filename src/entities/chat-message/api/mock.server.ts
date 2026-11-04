import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { mockContext, mockJson } from "@/shared/server";
import type { Chat, AiSettings } from "../model/chat.schema";

interface MockChatState {
  chat: Chat;
  settings: AiSettings;
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
    });
    const messages = [
      message("user", "이번 주 토요일에 뭐 있어?", 1),
      message(
        "assistant",
        "토요일 일정이에요.\n12:00 부모님 댁 점심 · 분당\n15:00 이케아 가구 보기 · 광명점\n15:00 가족 산책 · 공유\n다른 구성원의 개인 일정은 시간만 보여드려요.",
        2,
      ),
      message("user", "계란이랑 두부 장바구니에 담아줘", 3),
      message("assistant", "장바구니에 계란과 두부를 담았어요.", 4),
      message(
        "assistant",
        "토요일 15:00에 일정이 겹쳐요. ‘가족 산책’ 일정을 삭제해 드릴까요?",
        5,
      ),
    ];
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
                label: "가족 산책 삭제",
                payload: {},
                expected: {},
              },
            ],
            status: "draft",
            version: 1,
            expires_at: new Date(Date.now() + 300000).toISOString(),
          },
        ],
      },
    };
    context.values.set(key, state);
  }
  if (state.chat.expiresAt && Date.parse(state.chat.expiresAt) <= Date.now()) {
    state.chat.sessionVersion++;
    state.chat.expiresAt = null;
    state.chat.messages = [];
    state.chat.runs = [];
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
    name: mock.state.settings.name,
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
  const mock = (await mockState())!;
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
    });
    state.chat.runs.push({
      id: randomUUID(),
      input_message_id: id,
      status: "queued",
      progress: "",
      version: 1,
      error_code: null,
    });
    return { data: { id } };
  }
  if (operation === "confirm-actions" || operation === "cancel-actions") {
    const proposal = state.chat.proposals.find(
      (entry) => entry.id === input.id,
    );
    if (
      !proposal ||
      proposal.status !== "draft" ||
      proposal.version !== input.version ||
      Date.parse(proposal.expires_at) <= Date.now()
    )
      throw new ApiError(
        "state_conflict",
        "내용이 바뀌었거나 만료되었어요.",
        409,
      );
    proposal.status = operation === "cancel-actions" ? "cancelled" : "applied";
    proposal.result = proposal.actions
      .filter((_, index) => (input.selected as number[]).includes(index))
      .map(({ label }) => ({ label }));
    proposal.version++;
    return { data: null };
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
