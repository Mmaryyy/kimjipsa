import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatSchema, settingsSchema } from "../model/chat.schema";
import { mockChatCommand, mockChatPage } from "./mock.server";

vi.mock("server-only", () => ({}));

const context = vi.hoisted(() => ({
  enabled: true,
  values: new Map<string, unknown>(),
  perspective: 0,
}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => (context.enabled ? context : null),
  mockJson: async (name: string) =>
    name === "event-categories"
      ? [{ id: "10000000-0000-4000-8000-000000000012", name: "병원" }]
      : {
          id: "10000000-0000-4000-8000-000000000001",
          members: [{ display_name: "지수" }, { display_name: "민호" }],
        },
}));
beforeEach(() => {
  context.values.clear();
  context.enabled = true;
  context.perspective = 0;
});

describe("BOT-01/08/10 P11 대화 목업", () => {
  it("조회·직접 요청 결과·확인 대기를 실제 응답 계약으로 보여줘요", async () => {
    const chat = chatSchema.parse(await mockChatPage(null));
    expect(chat.messages).toHaveLength(6);
    expect(chat.messages[4]).toMatchObject({
      choices: [],
      awaiting_answer: true,
    });
    expect(chat.messages[3].awaiting_answer).toBe(false);
    expect(chat.sessionVersion).toBe(1);
    expect(
      chat.messages.every((message) => message.visibility === "private"),
    ).toBe(true);
    expect(chat.expiresAt).toBeNull();
    expect(chat.runs[0].input_message_id).toBe(chat.messages[2].id);
    expect(chat.messages[2].role).toBe("user");
    expect(chat.proposals[0].status).toBe("draft");
    expect(
      settingsSchema.parse((await mockChatCommand("settings", {}))?.data).name,
    ).toBe("집사");
  });
  it("개인 대화는 다른 구성원과 나뉘어요", async () => {
    await mockChatCommand("send", {
      sessionVersion: 1,
      text: "내 요청",
      attachmentIds: [],
    });
    expect((await mockChatPage(null))?.messages).toHaveLength(7);
    context.perspective = 1;
    const other = (await mockChatPage(null))!;
    expect(other.messages).toHaveLength(6);
    expect(other.messages.some((message) => message.text === "내 요청")).toBe(
      false,
    );
  });
  it("오래된 버전을 거절하고 설정 변경을 유지해요", async () => {
    const chat = (await mockChatPage(null))!;
    chat.proposals[0].expires_at = new Date(Date.now() - 1).toISOString();
    await expect(
      mockChatCommand("confirm-actions", {
        id: chat.proposals[0].id,
        version: 2,
        selected: [0],
      }),
    ).rejects.toThrow("만료");
    await mockChatCommand("save-settings", {
      name: "데비",
      memoryEnabled: false,
    });
    expect((await mockChatPage(null))?.name).toBe("데비");
    expect((await mockChatCommand("settings", {}))?.data).toMatchObject({
      name: "데비",
      memoryEnabled: false,
    });
  });
  it("마지막 메시지 후 1시간에 기록을 지우고 이전 세션 전송을 거절해요", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-04T03:00:00Z"));
      const initial = (await mockChatPage(null))!;
      initial.proposals[0].status = "cancelled";
      vi.setSystemTime(new Date("2026-11-04T03:30:00Z"));
      await mockChatCommand("send", {
        sessionVersion: 1,
        text: "새 요청",
        attachmentIds: [],
      });
      const active = chatSchema.parse(await mockChatPage(null));
      expect(active.expiresAt).toBe("2026-11-04T04:30:00.000Z");
      vi.setSystemTime(new Date("2026-11-04T04:30:00Z"));
      const expired = chatSchema.parse(await mockChatPage(null));
      expect(expired).toMatchObject({
        sessionVersion: 2,
        expiresAt: null,
        messages: [],
        runs: [],
        proposals: [],
        receipts: [],
        attachments: [],
      });
      await expect(
        mockChatCommand("send", {
          sessionVersion: 1,
          text: "지난 세션",
          attachmentIds: [],
        }),
      ).rejects.toThrow("만료");
      await mockChatCommand("send", {
        sessionVersion: 2,
        text: "새 대화",
        attachmentIds: [],
      });
      expect(chatSchema.parse(await mockChatPage(null)).messages).toHaveLength(
        1,
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("목업이 꺼져 있으면 실제 경로로 넘겨요", async () => {
    context.enabled = false;
    expect(await mockChatPage(null)).toBeNull();
    expect(await mockChatCommand("settings", {})).toBeNull();
  });
});

it("BOT-07 선택지와 보낸 답장을 다시 조회해도 유지해요", async () => {
  const first = chatSchema.parse(await mockChatPage(null));
  const question = first.messages.at(-1)!;
  expect(question.choices).toHaveLength(2);
  expect(question.awaiting_answer).toBe(true);
  await mockChatCommand("send", {
    sessionVersion: first.sessionVersion,
    text: question.choices[1].label,
    attachmentIds: [],
  });
  const refreshed = chatSchema.parse(await mockChatPage(null));
  expect(
    refreshed.messages.find((message) => message.id === question.id)?.choices,
  ).toEqual(question.choices);
  expect(refreshed.messages.at(-1)?.text).toBe("개인 일정");
  expect(refreshed.messages.at(-1)?.awaiting_answer).toBe(false);
});

it("BOT-07/08 SCN-BOT-6 수정 뒤 확인 결과는 새 메시지이며 취소는 값을 버려요", async () => {
  const chat = (await mockChatPage(null))!;
  const p = chat.proposals[0];
  const actions = structuredClone(p.actions);
  const event = actions[0].payload.event as Record<string, string>;
  event.title = "정기 검진";
  await mockChatCommand("edit-actions", { id: p.id, version: 1, actions });
  expect(chat.messages).toHaveLength(6);
  expect(p.actions[0].label).toContain("정기 검진");
  await mockChatCommand("confirm-actions", {
    id: p.id,
    version: 2,
    selected: [0],
  });
  expect((await mockChatPage(null))?.messages.at(-1)?.text).toContain(
    "정기 검진 개인 일정을 추가했어요",
  );
  expect(p.status).toBe("applied");
  p.status = "draft";
  await mockChatCommand("cancel-actions", {
    id: p.id,
    version: 3,
    selected: [],
  });
  expect(p.actions).toEqual([]);
  expect(p.status).toBe("cancelled");
});

it("BOT-08 SCN-BOT-6 단일 변경을 수정하면 질문 하나로 다시 확인해요", async () => {
  const chat = (await mockChatPage(null))!;
  const p = chat.proposals[0];
  p.actions = [p.actions[0]];
  await mockChatCommand("edit-actions", {
    id: p.id,
    version: 1,
    actions: p.actions,
  });
  expect(p.actions[0].label).toBe(
    "11월 7일 15:00, 치과, 병원 카테고리의 개인 일정으로 추가할까요?",
  );
  await mockChatCommand("confirm-actions", {
    id: p.id,
    version: 2,
    selected: [0],
  });
  const result = (await mockChatPage(null))?.messages.at(-1)?.text;
  expect(result).toContain("추가했어요");
  expect(result).not.toContain("할까요?");
});
