import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Chat, chatSchema, settingsSchema } from "../model/chat.schema";
import { mockJson } from "@/shared/server";
import { mockChatCommand, mockChatPage } from "./mock.server";

vi.mock("server-only", () => ({}));

const context = vi.hoisted(() => ({
  enabled: true,
  values: new Map<string, unknown>(),
  perspective: 0,
  stage: "ready",
}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => (context.enabled ? context : null),
  mockJson: async (name: string) => {
    if (name === "event-categories")
      return [{ id: "10000000-0000-4000-8000-000000000012", name: "병원" }];
    if (name === "inventory-meta" || name === "inventory-items") {
      if (!context.values.has(name))
        context.values.set(
          name,
          JSON.parse(readFileSync(`mocks/${name}.json`, "utf8")),
        );
      return context.values.get(name);
    }
    return {
      id: "10000000-0000-4000-8000-000000000001",
      members: [{ display_name: "지수" }, { display_name: "민호" }],
    };
  },
}));
beforeEach(() => {
  context.values.clear();
  context.enabled = true;
  context.perspective = 0;
  context.stage = "ready";
});

describe("INV-17 영수증 목업", () => {
  it("초기 대화에서 보낸 사진과 영수증 초안이 보여요", async () => {
    const chat = chatSchema.parse(await mockChatPage(null));
    const request = chat.messages.at(-2)!;
    const response = chat.messages.at(-1);
    expect(request).toMatchObject({ role: "user", text: "영수증 등록해줘" });
    expect(response).toMatchObject({
      role: "assistant",
      text: "영수증에서 찾은 품목을 확인해 주세요.",
    });
    expect(request.attachment_ids).toHaveLength(1);
    expect(chat.attachments).toEqual([
      expect.objectContaining({
        id: request.attachment_ids[0],
        status: "ready",
      }),
    ]);
    expect(chat.runs.at(-1)).toMatchObject({
      input_message_id: request.id,
      status: "completed",
    });
    expect(chat.receipts).toHaveLength(1);
    const [receipt] = chat.receipts;
    expect(receipt).toMatchObject({
      run_id: chat.runs.at(-1)?.id,
      kind: "receipt",
      status: "draft",
    });
    expect(Date.parse(receipt.expires_at)).toBeGreaterThan(
      Date.now() + 3600000,
    );
    expect(receipt.items).toHaveLength(9);
    expect(receipt.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "우유",
          inventory_item_id: expect.any(String),
        }),
        expect.objectContaining({ name: "바나나", inventory_item_id: null }),
        expect.objectContaining({ unit_id: null, selected: true }),
        expect.objectContaining({ reason: "맛과 종류를 확인해 주세요." }),
        expect.objectContaining({ selected: false }),
      ]),
    );
  });

  it("SCN-INV-6 선택한 품목만 한 번 재고에 반영해요", async () => {
    const [receipt] = chatSchema.parse(await mockChatPage(null)).receipts;
    const inventory = await mockJson("inventory-items");
    const milk = inventory.find(({ name }) => name === "우유")!;
    const before = structuredClone(inventory);
    const { id, version } = receipt;
    await expect(
      mockChatCommand("confirm", { id, version, items: receipt.items }),
    ).rejects.toMatchObject({ code: "invalid_inventory" });
    expect(await mockJson("inventory-items")).toEqual(before);

    const items = receipt.items.map((item) =>
      item.unit_id ? item : { ...item, selected: false },
    );
    const input = { id, version, items };
    await Promise.all([
      mockChatCommand("confirm", input),
      mockChatCommand("confirm", input),
    ]);
    expect(inventory.find((item) => item.id === milk.id)).toEqual({
      ...milk,
      quantity: milk.quantity + 2,
    });
    expect(inventory.find(({ name }) => name === "바나나")).toMatchObject({
      mode: "quantity",
      quantity: 1,
    });
    expect(
      inventory.some(({ name }) => ["종이봉투", "감자"].includes(name)),
    ).toBe(false);
    expect((await mockChatPage(null))?.receipts[0]).toMatchObject({
      status: "applied",
      version: version + 1,
      items,
    });
  });

  it("취소하면 재고를 유지하고 목업을 초기화하면 새 초안이 보여요", async () => {
    const [draft] = chatSchema.parse(await mockChatPage(null)).receipts;
    const before = structuredClone(await mockJson("inventory-items"));
    await mockChatCommand("cancel-receipt", {
      id: draft.id,
      version: draft.version,
    });
    expect((await mockChatPage(null))?.receipts[0].status).toBe("cancelled");
    expect(await mockJson("inventory-items")).toEqual(before);

    context.values.clear();
    const [reset] = chatSchema.parse(await mockChatPage(null)).receipts;
    expect(reset).toMatchObject({
      status: "draft",
      version: 1,
      items: draft.items,
    });
    expect(reset.id).not.toBe(draft.id);
  });

  it("준비 단계 밖에서는 영수증 예시가 없어요", async () => {
    context.stage = "login";
    expect((await mockChatPage(null))?.receipts).toEqual([]);
  });
});

describe("BOT-01/08/10 P11 대화 목업", () => {
  it("조회·직접 요청 결과·확인 대기를 실제 응답 계약으로 보여줘요", async () => {
    const chat = chatSchema.parse(await mockChatPage(null));
    expect(chat.messages).toHaveLength(8);
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
    expect((await mockChatPage(null))?.messages).toHaveLength(9);
    context.perspective = 1;
    const other = (await mockChatPage(null))!;
    expect(other.messages).toHaveLength(8);
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
  const question = first.messages.find((message) => message.choices.length)!;
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
  expect(chat.messages).toHaveLength(8);
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

it.each([
  ["inventory", "우유 1개 재고를 수정할까요 (기타)?"],
  ["cart", "우유 1개 장바구니에 수정할까요 (기타)?"],
] as const)(
  "INV-11 CART-11 SCN-BOT-6 %s 수정에 새 카테고리를 표시해요",
  async (domain, label) => {
    const chat = (await mockChatPage(null))!;
    const proposal = chat.proposals[0];
    const cart = proposal.actions[1];
    const item = cart.payload.item as Record<string, string | number | null>;
    const action = {
      ...cart,
      domain,
      payload: {
        action: "save",
        id: proposal.id,
        item: { ...item, mode: "quantity" },
      },
    };
    proposal.actions = [action];
    await mockChatCommand("edit-actions", {
      id: proposal.id,
      version: 1,
      actions: [
        {
          ...action,
          payload: {
            ...action.payload,
            item: {
              ...action.payload.item,
              category_id: "006c5fbc-1462-40cf-83df-c1d910eb2f6b",
            },
          },
        },
      ],
    });
    expect(proposal.actions[0].label).toBe(label);
  },
);

describe("BOT-01 재시도 목업", () => {
  it.each(["failed", "cancelled", "unknown"] as const)(
    "%s 요청은 새 메시지 없이 한 번만 다시 전송해요",
    async (status) => {
      await mockChatCommand("send", {
        sessionVersion: 1,
        text: "우유 담아줘",
        attachmentIds: [],
      });
      const chat = (await mockChatPage(null))!;
      const run = chat.runs.at(-1)!;
      run.status = status;
      const input = { id: run.id, clientRequestId: crypto.randomUUID() };
      const result = await mockChatCommand("retry", input);
      expect(await mockChatCommand("retry", input)).toEqual(result);
      const retried = (await mockChatPage(null))!;
      expect(retried.messages).toHaveLength(chat.messages.length);
      expect(retried.messages.at(-1)?.id).toBe(chat.messages.at(-1)?.id);
      expect(
        retried.runs.filter(
          (entry) => entry.input_message_id === run.input_message_id,
        ),
      ).toEqual([
        expect.objectContaining({
          status: "queued",
          input_message_id: run.input_message_id,
        }),
      ]);
      await expect(
        mockChatCommand("retry", {
          ...input,
          clientRequestId: crypto.randomUUID(),
        }),
      ).rejects.toThrow("만료");
    },
  );
  it.each(["queued", "running", "completed"] as const)(
    "%s 요청 재시도를 거절해요",
    async (status) => {
      const chat = (await mockChatPage(null))!;
      chat.runs[0].status = status;
      await expect(
        mockChatCommand("retry", {
          id: chat.runs[0].id,
          clientRequestId: crypto.randomUUID(),
        }),
      ).rejects.toThrow("만료");
    },
  );
  it("다른 구성원의 요청과 만료된 요청은 재시도하지 않아요", async () => {
    const chat = (await mockChatPage(null))!;
    chat.runs[0].status = "failed";
    const input = { id: chat.runs[0].id, clientRequestId: crypto.randomUUID() };
    context.perspective = 1;
    await expect(mockChatCommand("retry", input)).rejects.toThrow("권한");
    context.perspective = 0;
    chat.proposals[0].status = "cancelled";
    const state = context.values.get("chat:private:0") as { chat: Chat };
    state.chat.expiresAt = new Date(Date.now() - 1).toISOString();
    await expect(mockChatCommand("retry", input)).rejects.toMatchObject({
      code: "chat_expired",
      status: 410,
    });
    expect((await mockChatPage(null))?.messages).toHaveLength(0);
  });
});

it("BOT-14 재시도는 만료를 연장하고 이전 내 메시지는 다시 보내지 않아요", async () => {
  await mockChatCommand("send", {
    sessionVersion: 1,
    text: "첫 요청",
    attachmentIds: [],
  });
  const chat = (await mockChatPage(null))!;
  const run = chat.runs.at(-1)!;
  run.status = "failed";
  chat.proposals[0].status = "cancelled";
  const state = context.values.get("chat:private:0") as { chat: Chat };
  state.chat.expiresAt = new Date(Date.now() + 1000).toISOString();
  await mockChatCommand("retry", {
    id: run.id,
    clientRequestId: crypto.randomUUID(),
  });
  expect(Date.parse(state.chat.expiresAt!)).toBeGreaterThan(
    Date.now() + 3590000,
  );
  await mockChatCommand("send", {
    sessionVersion: 1,
    text: "다음 요청",
    attachmentIds: [],
  });
  await expect(
    mockChatCommand("retry", {
      id: run.id,
      clientRequestId: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "state_conflict", status: 409 });
});
