import { describe, expect, it } from "vitest";
import { chatSchema, sendSchema } from "./chat.schema";
import { mergeChatPages } from "./chat.utils";

const id = "10000000-0000-4000-8000-000000000001";
const page = (version: number, text?: string) =>
  chatSchema.parse({
    familyId: id,
    name: "집사",
    workerOnline: true,
    sessionVersion: version,
    expiresAt: text ? new Date(Date.now() + 3600000).toISOString() : null,
    nextBefore: text ? 5 : null,
    messages: text
      ? [
          {
            id,
            sequence: 10,
            role: "assistant",
            author: "김집사",
            text,
            attachment_ids: [],
            created_at: new Date().toISOString(),
            visibility: "private",
          },
        ]
      : [],
    runs: [],
    receipts: [],
    proposals: [],
    attachments: text
      ? [{ id, status: "ready", expires_at: new Date().toISOString() }]
      : [],
  });

describe("BOT-11/14 개인 대화 세션", () => {
  it.each([false, true])(
    "만료 전 페이지가 늦게 와도 원문·첨부·커서를 되살리지 않아요 (%s)",
    (late) => {
      const old = page(1, "삭제된 기록");
      const current = page(2);
      const merged = mergeChatPages(late ? [current, old] : [old, current]);
      expect(merged).toMatchObject({
        sessionVersion: 2,
        messages: [],
        attachments: [],
        nextBefore: null,
      });
    },
  );
  it("같은 세션을 다시 조회해도 메시지가 중복되지 않아요", () => {
    expect(
      mergeChatPages([page(1, "현재 대화"), page(1, "현재 대화")])?.messages,
    ).toHaveLength(1);
  });
  it("공개 범위 생략은 개인 대화이며 공용 전송과 세션 없는 전송은 거절해요", () => {
    const input = {
      text: "요청",
      attachmentIds: [],
      clientRequestId: id,
      sessionVersion: 1,
    };
    expect(sendSchema.parse(input).visibility).toBe("private");
    expect(
      sendSchema.safeParse({ ...input, visibility: "shared" }).success,
    ).toBe(false);
    expect(
      sendSchema.safeParse({ ...input, sessionVersion: undefined }).success,
    ).toBe(false);
  });
});
