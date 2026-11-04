// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { mapAgentEvents } from "@/entities/event/index.server";
import { parseAgentActions } from "./agent-actions.schema";
import { agentResultSchema } from "@/entities/chat-message/index.server";
vi.mock("server-only", () => ({}));
const owner = "10000000-0000-4000-8000-000000000001";
const partner = "10000000-0000-4000-8000-000000000002";
const eventId = "10000000-0000-4000-8000-000000000003";
const category = "10000000-0000-4000-8000-000000000004";
const details = {
  title: "PRIVATE_TITLE",
  place: "PRIVATE_PLACE",
  memo: "PRIVATE_MEMO",
  category_id: category,
  remind_before: 30,
  dday_style: "normal",
  celebrate_message: "",
};
const event = {
  id: eventId,
  owner_id: owner,
  visibility: "private",
  start_date: "2026-11-01",
  end_date: "2026-11-01",
  start_time: null,
  end_time: null,
  is_all_day: true,
  kind: "event",
  recurrence: "weekly",
  recurrence_until: null,
  event_details: details,
};
const range = { start: "2026-11-01", end: "2026-11-30" };
const exception = {
  event_id: eventId,
  original_date: "2026-11-08",
  cancelled: false,
  start_date: "2026-11-09",
  end_date: "2026-11-09",
  start_time: null,
  end_time: null,
  is_all_day: true,
  event_details: { ...details, title: "PRIVATE_EXCEPTION" },
};
describe("BOT-06/10 CAL-04/14 챗봇 일정 응답", () => {
  it.each([
    [owner, "shared"],
    [partner, "shared"],
    [partner, "private"],
  ] as const)(
    "SCN-CAL-2/4 %s %s에서 개인 일정 원문과 예외를 전달하지 않아요",
    (viewer, visibility) => {
      const result = mapAgentEvents(
        { records: [event], exceptions: [exception] },
        viewer,
        visibility,
        range,
      );
      expect(result).toHaveLength(5);
      expect(
        result.every((entry) => entry.details === null && !entry.canEdit),
      ).toBe(true);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_");
      expect(result[1].startDate).toBe("2026-11-09");
    },
  );
  it("작성자의 나만 보기에서는 반복 수정·취소를 반영한 일정을 보여줘요", () => {
    const result = mapAgentEvents(
      {
        records: [event],
        exceptions: [
          exception,
          { ...exception, original_date: "2026-11-15", cancelled: true },
        ],
      },
      owner,
      "private",
      range,
    );
    expect(result.map((entry) => entry.startDate)).toEqual([
      "2026-11-01",
      "2026-11-09",
      "2026-11-22",
      "2026-11-29",
    ]);
    expect(result[1].details?.title).toBe("PRIVATE_EXCEPTION");
    expect(result[1].seriesId).toBe(eventId);
    expect(result[1].originalDate).toBe("2026-11-08");
  });
});
describe("BOT-07 입력 검증", () => {
  it("INV-01 음수 수량으로 저장하는 응답은 실행하지 않아요", () => {
    expect(() =>
      parseAgentActions([
        {
          domain: "inventory",
          label: "수정",
          payload: {
            action: "save",
            id: eventId,
            item: {
              name: "우유",
              mode: "quantity",
              quantity: -1,
              status: "enough",
              unit_id: category,
              category_id: null,
              location_id: null,
              min_quantity: null,
              expires_on: null,
            },
          },
        },
      ]),
    ).toThrow();
  });
  it("CART-07 필수 보관 장소가 없는 구매 완료는 실행하지 않아요", () => {
    expect(() =>
      parseAgentActions([
        {
          domain: "cart",
          label: "구매 완료",
          payload: {
            action: "restock",
            entries: [
              {
                id: eventId,
                quantity: 1,
                unit_id: category,
                category_id: category,
                location_id: null,
                expires_on: null,
              },
            ],
          },
        },
      ]),
    ).toThrow();
  });
  it("CAL-02 종료가 시작보다 빠른 일정은 실행하지 않아요", () => {
    expect(() =>
      parseAgentActions([
        {
          domain: "event",
          label: "일정 등록",
          payload: {
            id: null,
            event: {
              title: "약속",
              place: "",
              memo: "",
              categoryId: category,
              visibility: "shared",
              startDate: "2026-11-02",
              endDate: "2026-11-01",
              startTime: null,
              endTime: null,
              isAllDay: true,
            },
          },
        },
      ]),
    ).toThrow();
  });
  it("지원하지 않는 장바구니 작업을 거절해요", () => {
    expect(() =>
      parseAgentActions([
        {
          domain: "cart",
          label: "삭제",
          payload: { action: "delete", id: eventId },
        },
      ]),
    ).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "https://user:secret@example.com/",
    "file:///tmp/private",
  ])("웹 검색 출처 %s를 노출하지 않아요", (url) => {
    expect(
      agentResultSchema.safeParse({
        kind: "reply",
        text: "검색 결과",
        sources: [{ title: "출처", url }],
      }).success,
    ).toBe(false);
  });
});

const eventAction = (overrides: Record<string, unknown> = {}) => [
  {
    domain: "event",
    label: "치과 등록",
    payload: {
      id: null,
      event: {
        title: "치과",
        categoryId: category,
        visibility: "private",
        startDate: "2026-11-05",
        endDate: "2026-11-05",
        startTime: "15:00",
        endTime: null,
        isAllDay: false,
        ...overrides,
      },
    },
  },
];
it.each([{}, { place: null, memo: null, celebrateMessage: null }])(
  "BOT-07 장소·메모 생략과 null을 agent 경로에서만 허용해요",
  (fields) => {
    expect(
      parseAgentActions(eventAction(fields))[0].payload.event,
    ).toMatchObject({ place: "", memo: "", celebrateMessage: "" });
  },
);
it.each([
  "categoryId",
  "visibility",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
])("BOT-07 %s 누락은 보정하지 않고 필드 경로로 거절해요", (field) => {
  expect(() =>
    parseAgentActions(
      JSON.parse(JSON.stringify(eventAction({ [field]: undefined }))),
    ),
  ).toThrow();
});
it("BOT-07 categoryId 누락 진단에는 전체 액션 경로를 남겨요", () => {
  try {
    parseAgentActions(
      JSON.parse(JSON.stringify(eventAction({ categoryId: undefined }))),
    );
    throw new Error("accepted");
  } catch (error) {
    expect(error).toMatchObject({
      issues: [
        expect.objectContaining({
          path: ["actions", 0, "payload", "event", "categoryId"],
        }),
      ],
    });
  }
});
it("BOT-07 선택지는 reply에만 서로 다른 2~6개를 허용해요", () => {
  const choices = [
    { label: "공유 일정", value: "shared" },
    { label: "개인 일정", value: "private" },
  ];
  expect(
    agentResultSchema.parse({ kind: "reply", text: "공개 범위는요?", choices })
      .choices,
  ).toEqual(choices);
  for (const invalid of [
    choices.slice(0, 1),
    Array(7).fill(choices[0]),
    [choices[0], choices[0]],
  ])
    expect(
      agentResultSchema.safeParse({
        kind: "reply",
        text: "질문",
        choices: invalid,
      }).success,
    ).toBe(false);
  expect(
    agentResultSchema.safeParse({
      kind: "actions",
      text: "실행",
      choices,
      actions: eventAction(),
    }).success,
  ).toBe(false);
  expect(
    agentResultSchema.parse({ kind: "reply", text: "언제인가요?" }).choices,
  ).toEqual([]);
});

it("BOT-07/08 되묻기는 표시하고 다른 결과에는 표시를 거절해요", () => {
  expect(
    agentResultSchema.parse({
      kind: "reply",
      text: "언제인가요?",
      awaitingAnswer: true,
    }).awaitingAnswer,
  ).toBe(true);
  expect(
    agentResultSchema.parse({
      kind: "reply",
      text: "공개 범위는요?",
      awaitingAnswer: false,
      choices: [
        { label: "공유 일정", value: "shared" },
        { label: "개인 일정", value: "private" },
      ],
    }).awaitingAnswer,
  ).toBe(true);
  expect(
    agentResultSchema.parse({ kind: "reply", text: "조회 결과예요" })
      .awaitingAnswer,
  ).toBe(false);
  expect(
    agentResultSchema.safeParse({
      kind: "actions",
      text: "등록",
      actions: eventAction(),
      awaitingAnswer: true,
    }).success,
  ).toBe(false);
  expect(
    agentResultSchema.safeParse({
      kind: "reply",
      text: "질문",
      awaitingAnswer: "true",
    }).success,
  ).toBe(false);
});
