// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveEvent,
  deleteEvent,
  listEvents,
  getEvent,
} from "@/entities/event/index.server";
const state = vi.hoisted(() => ({
  perspective: 0,
  stage: "ready",
  values: new Map<string, unknown>(),
  fixtures: {} as Record<string, unknown>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => state,
  mockJson: async (name: string) => state.fixtures[name],
  createServerSupabaseClient: vi.fn(() => {
    throw new Error("목업에서 DB에 접근했어요.");
  }),
  throwDatabaseError: vi.fn(),
}));
const input = {
  title: "매주 일정",
  place: "개인 장소",
  memo: "개인 메모",
  categoryId: "10000000-0000-4000-8000-000000000011",
  visibility: "shared",
  startDate: "2026-10-02",
  endDate: "2026-10-02",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  recurrence: "weekly",
};
const range = { start: "2026-10-01", end: "2026-10-31" };
beforeEach(() => {
  state.perspective = 0;
  state.values.clear();
  for (const name of [
    "family",
    "events",
    "event-categories",
    "notifications",
    "event-exceptions",
  ])
    state.fixtures[name] = JSON.parse(
      readFileSync(`mocks/${name}.json`, "utf8"),
    );
});
describe("CAL-14 CAL-04 반복 일정 서버 응답", () => {
  it("한 회차 수정·취소가 다른 회차를 바꾸지 않아요", async () => {
    const id = await saveEvent(input);
    await saveEvent(
      {
        ...input,
        startDate: "2026-10-09",
        endDate: "2026-10-09",
        title: "변경한 회차",
        scope: "single",
      },
      `${id}~2026-10-09`,
    );
    await deleteEvent(`${id}~2026-10-16`, undefined, { scope: "single" });
    const events = (await listEvents(undefined, range)).filter(
      (event) => event.seriesId === id,
    );
    expect(events.map((event) => event.startDate)).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-23",
      "2026-10-30",
    ]);
    expect(events[1].details?.title).toBe("변경한 회차");
    expect(events[2].details?.title).toBe(input.title);
    expect(await getEvent(`${id}~2026-10-16`)).toBeNull();
  });
  it("이후 회차를 나누어도 이전 회차는 남아요", async () => {
    const id = await saveEvent(input);
    const newId = await saveEvent(
      {
        ...input,
        title: "이후 일정",
        startDate: "2026-10-16",
        endDate: "2026-10-16",
        scope: "following",
      },
      `${id}~2026-10-16`,
    );
    const events = await listEvents(undefined, range);
    expect(
      events
        .filter((event) => event.seriesId === id)
        .map((event) => event.startDate),
    ).toEqual(["2026-10-02", "2026-10-09"]);
    expect(
      events
        .filter((event) => event.seriesId === newId)
        .map((event) => event.startDate),
    ).toEqual(["2026-10-16", "2026-10-23", "2026-10-30"]);
  });
  it.each(["2026-10-02", "2026-10-16"])(
    "이후 수정은 선택한 %s 예외를 지우고 뒤의 예외는 보존해요",
    async (date) => {
      const id = await saveEvent(input);
      for (const [day, title] of [
        [date, "제목 A"],
        ["2026-10-23", "뒤의 예외"],
      ]) {
        await saveEvent(
          { ...input, title, startDate: day, endDate: day, scope: "single" },
          `${id}~${day}`,
        );
      }
      const newId = await saveEvent(
        {
          ...input,
          title: "제목 B",
          startDate: date,
          endDate: date,
          scope: "following",
        },
        `${id}~${date}`,
      );
      expect((await getEvent(`${newId}~${date}`))?.details?.title).toBe(
        "제목 B",
      );
      expect((await getEvent(`${newId}~2026-10-23`))?.details?.title).toBe(
        "뒤의 예외",
      );
    },
  );
  it("옮긴 회차에서 이후 수정하면 새 날짜의 첫 회차에 저장한 내용을 보여 줘요", async () => {
    const id = await saveEvent(input);
    const moved = { ...input, startDate: "2026-10-18", endDate: "2026-10-18" };
    await saveEvent(
      { ...moved, title: "제목 A", scope: "single" },
      `${id}~2026-10-16`,
    );
    const newId = await saveEvent(
      { ...moved, title: "제목 B", scope: "following" },
      `${id}~2026-10-16`,
    );
    expect((await getEvent(`${newId}~2026-10-18`))?.details?.title).toBe(
      "제목 B",
    );
  });
  it("CAL-09 회차 수정·삭제 알림은 고른 회차를 가리켜요", async () => {
    const id = await saveEvent(input);
    await saveEvent(
      {
        ...input,
        startDate: "2026-10-09",
        endDate: "2026-10-09",
        scope: "single",
      },
      `${id}~2026-10-09`,
    );
    await deleteEvent(`${id}~2026-10-16`, undefined, { scope: "single" });
    const notices = state.fixtures.notifications as {
      kind: string;
      payload: {
        eventId?: string;
        occurrenceDate?: string;
        eventDeleted?: boolean;
      };
    }[];
    expect(notices.filter((entry) => entry.payload.eventId === id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "event_updated",
          payload: expect.objectContaining({
            occurrenceDate: "2026-10-09",
            eventDeleted: false,
          }),
        }),
        expect.objectContaining({
          kind: "event_deleted",
          payload: expect.objectContaining({ occurrenceDate: "2026-10-16" }),
        }),
      ]),
    );
  });
  it("SCN-CAL-2 배우자에게 개인 회차의 내용과 예외 내용을 보내지 않아요", async () => {
    const id = await saveEvent({ ...input, visibility: "private" });
    await saveEvent(
      {
        ...input,
        visibility: "private",
        title: "비밀 예외",
        startDate: "2026-10-09",
        endDate: "2026-10-09",
        scope: "single",
      },
      `${id}~2026-10-09`,
    );
    state.perspective = 1;
    const events = (await listEvents(undefined, range)).filter(
      (event) => event.seriesId === id,
    );
    expect(events).toHaveLength(5);
    expect(events.every((event) => event.details === null)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/비밀 예외|개인 장소|개인 메모/);
    expect(await getEvent(`${id}~2026-10-09`)).toBeNull();
    await expect(
      deleteEvent(`${id}~2026-10-09`, undefined, { scope: "single" }),
    ).rejects.toThrow("작성자");
  });
  it("공유에서 개인으로 바꾸면 다른 회차의 예외 내용도 보호해요", async () => {
    const id = await saveEvent(input);
    await saveEvent(
      {
        ...input,
        title: "이전 예외 제목",
        startDate: "2026-10-09",
        endDate: "2026-10-09",
        scope: "single",
      },
      `${id}~2026-10-09`,
    );
    await saveEvent(
      {
        ...input,
        visibility: "private",
        startDate: "2026-10-16",
        endDate: "2026-10-16",
        scope: "single",
      },
      `${id}~2026-10-16`,
    );
    state.perspective = 1;
    const events = (await listEvents(undefined, range)).filter(
      (event) => event.seriesId === id,
    );
    expect(
      events.every(
        (event) => event.details === null && event.visibility === "private",
      ),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(
      /이전 예외 제목|개인 장소|개인 메모/,
    );
  });
  it("분할된 규칙을 다시 수정해도 종료 경계를 넘어서 늘어나지 않아요", async () => {
    const id = await saveEvent(input);
    await saveEvent(
      {
        ...input,
        startDate: "2026-10-16",
        endDate: "2026-10-16",
        scope: "following",
      },
      `${id}~2026-10-16`,
    );
    await saveEvent(
      { ...input, title: "앞부분 변경", scope: "following" },
      `${id}~2026-10-02`,
    );
    const events = (await listEvents(undefined, range)).filter(
      (event) => event.seriesId === id,
    );
    expect(events.map((event) => event.startDate)).toEqual([
      "2026-10-02",
      "2026-10-09",
    ]);
  });
  it("한 회차는 원래 규칙의 종료일 뒤로도 옮길 수 있어요", async () => {
    const id = await saveEvent(input);
    await deleteEvent(`${id}~2026-10-16`, undefined, { scope: "following" });
    await saveEvent(
      {
        ...input,
        title: "다음 달로 옮긴 회차",
        startDate: "2026-11-02",
        endDate: "2026-11-02",
        scope: "single",
      },
      `${id}~2026-10-09`,
    );
    const moved = await getEvent(`${id}~2026-10-09`);
    expect(moved?.startDate).toBe("2026-11-02");
    expect(moved?.details?.title).toBe("다음 달로 옮긴 회차");
    expect(
      (await listEvents(undefined, range))
        .filter((event) => event.seriesId === id)
        .map((event) => event.startDate),
    ).toEqual(["2026-10-02"]);
  });
  it("D-day에는 일반 반복 규칙을 붙일 수 없어요", async () => {
    await expect(
      saveEvent({
        ...input,
        kind: "dday",
        isAllDay: true,
        startTime: null,
        endTime: null,
      }),
    ).rejects.toThrow();
  });
});
