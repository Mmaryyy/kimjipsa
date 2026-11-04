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
  mockJson: async () => ({
    id: "10000000-0000-4000-8000-000000000001",
    members: [{ display_name: "지수" }, { display_name: "민호" }],
  }),
}));
beforeEach(() => {
  context.values.clear();
  context.enabled = true;
  context.perspective = 0;
});

describe("BOT-01/08/10 P11 대화 목업", () => {
  it("조회·직접 요청 결과·확인 대기를 실제 응답 계약으로 보여줘요", async () => {
    const chat = chatSchema.parse(await mockChatPage(null));
    expect(chat.messages).toHaveLength(5);
    expect(chat.sessionVersion).toBe(1);
    expect(
      chat.messages.every((message) => message.visibility === "private"),
    ).toBe(true);
    expect(Date.parse(chat.expiresAt!)).toBe(
      Date.parse(chat.messages.at(-1)!.created_at) + 3600000,
    );
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
    expect((await mockChatPage(null))?.messages).toHaveLength(6);
    context.perspective = 1;
    const other = (await mockChatPage(null))!;
    expect(other.messages).toHaveLength(5);
    expect(other.messages.some((message) => message.text === "내 요청")).toBe(
      false,
    );
  });
  it("만료된 제안을 거절하고 설정 변경을 유지해요", async () => {
    const chat = (await mockChatPage(null))!;
    chat.proposals[0].expires_at = new Date(Date.now() - 1).toISOString();
    await expect(
      mockChatCommand("confirm-actions", {
        id: chat.proposals[0].id,
        version: 1,
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
      await mockChatPage(null);
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
