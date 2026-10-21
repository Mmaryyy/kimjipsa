import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../api/type";
import {
  ddayOccurrences,
  occurrencesInRange,
  upcomingOccurrences,
} from "./event-occurrences.utils";
const instant = new Date("2026-10-17T12:00:00+09:00");
function event(
  id: string,
  changes: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    kind: "event",
    ownerId: "owner",
    visibility: "shared",
    startDate: "2026-10-17",
    endDate: "2026-10-17",
    startTime: "14:00",
    endTime: "15:00",
    isAllDay: false,
    canEdit: true,
    canChangeVisibility: true,
    details: {
      title: id,
      place: "",
      memo: "",
      categoryId: "category",
      ddayStyle: "normal",
      celebrateMessage: "",
    },
    ...changes,
  };
}
describe("CAL-07 CAL-13 SCN-CAL-8 달력과 다가오는 일정", () => {
  it("오늘 시작 일정과 오늘 D-Day는 제외하고 내일 일정과 D-day는 포함해요", () => {
    const events = [
      event("today-ended", { startTime: "10:00", endTime: "11:00" }),
      event("today-later"),
      event("today-all-day", {
        isAllDay: true,
        startTime: null,
        endTime: null,
      }),
      event("today-unscheduled", { startTime: null, endTime: null }),
      event("today-dday", {
        kind: "dday",
        startDate: "2020-10-17",
        endDate: "2020-10-17",
      }),
      event("tomorrow", { startDate: "2026-10-18", endDate: "2026-10-18" }),
      event("tomorrow-dday", {
        kind: "dday",
        isAllDay: true,
        startTime: null,
        endTime: null,
        startDate: "2020-10-18",
        endDate: "2020-10-18",
      }),
    ];
    const upcoming = upcomingOccurrences(events, 5, instant);
    expect(upcoming.map(({ event }) => event.id)).toEqual([
      "tomorrow-dday",
      "tomorrow",
    ]);
    expect(upcoming[0].dday?.label).toBe("D-1");
  });
  it("기간 일정은 내일 이후 남은 첫날에 한 번 표시해요", () => {
    const events = [
      event("ongoing", { startDate: "2026-10-16", endDate: "2026-10-19" }),
      event("starts-today", { endDate: "2026-11-30" }),
      event("future-period", {
        startDate: "2026-10-20",
        endDate: "2026-10-25",
      }),
      event("ends-today", { startDate: "2026-10-15" }),
      event("later", { startDate: "2026-10-21", endDate: "2026-10-21" }),
    ];
    const upcoming = upcomingOccurrences(events, 5, instant);
    expect(
      upcoming.map(({ event, startDate }) => [event.id, startDate]),
    ).toEqual([
      ["ongoing", "2026-10-18"],
      ["starts-today", "2026-10-18"],
      ["future-period", "2026-10-20"],
      ["later", "2026-10-21"],
    ]);
    expect(upcoming[0].endDate).toBe("2026-10-19");
    expect(events[0].startDate).toBe("2026-10-16");
  });
  it("UTC 날짜가 달라도 KST 내일부터 표시하며 연말 경계를 넘겨요", () => {
    const events = [
      event("today", { startDate: "2026-12-31", endDate: "2026-12-31" }),
      event("new-year", { startDate: "2027-01-01", endDate: "2027-01-01" }),
    ];
    expect(
      upcomingOccurrences(events, 5, new Date("2026-12-30T15:30:00Z")).map(
        ({ event }) => event.id,
      ),
    ).toEqual(["new-year"]);
  });
  it("종일·시각순·시간 미정 순서이고 배우자 개인 내용은 만들지 않아요", () => {
    const events = [
      event("unscheduled", { startTime: null, endTime: null }),
      event("timed"),
      event("all-day", { isAllDay: true, startTime: null, endTime: null }),
      event("masked", { visibility: "private", details: null }),
    ];
    const rows = occurrencesInRange(
      events,
      "2026-10-17",
      "2026-10-17",
      instant,
    );
    expect(rows[0].event.id).toBe("all-day");
    expect(rows.at(-1)?.event.id).toBe("unscheduled");
    expect(
      rows.find(({ event }) => event.id === "masked")?.event.details,
    ).toBeNull();
  });
  it("월 경계의 기간 일정과 매년 D-day를 포함해요", () => {
    const events = [
      event("period", { startDate: "2026-09-29", endDate: "2026-10-02" }),
      event("dday", {
        kind: "dday",
        startDate: "2020-10-18",
        endDate: "2020-10-18",
      }),
    ];
    expect(
      occurrencesInRange(events, "2026-10-01", "2026-10-31", instant).map(
        ({ event }) => event.id,
      ),
    ).toEqual(["period", "dday"]);
    expect(
      occurrencesInRange(events, "2027-10-01", "2027-10-31", instant).map(
        ({ startDate }) => startDate,
      ),
    ).toEqual(["2027-10-18"]);
  });
  it.each([3, 5, 10])("사용자가 고른 %s개만 반환해요", (count) => {
    const events = Array.from({ length: 12 }, (_, index) =>
      event(`event-${index}`, {
        startDate: "2026-10-18",
        endDate: "2026-10-18",
      }),
    );
    expect(upcomingOccurrences(events, count, instant)).toHaveLength(count);
  });
  it("완료된 기간 일정과 빈 목록을 제외해요", () => {
    expect(
      upcomingOccurrences(
        [event("ended", { startDate: "2026-10-15", endTime: "11:00" })],
        5,
        instant,
      ),
    ).toEqual([]);
    expect(upcomingOccurrences([], 5, instant)).toEqual([]);
  });
});

it("CAL-06 SCN-CAL-9 범위 안 D-day도 오늘 기준으로 라벨을 계산해요", () => {
  const rows = occurrencesInRange(
    [event("dday", { kind: "dday", startDate: "2025-10-22" })],
    "2026-10-01",
    "2026-10-31",
    instant,
  );
  expect(rows[0].dday).toMatchObject({
    daysUntil: 5,
    label: "D-5",
    anniversary: 1,
  });
});

it("CAL-06 CAL-13 SCN-CAL-9 D-day 섹션은 당일을 포함하고 위젯과 독립적으로 정렬해요", () => {
  const events = [
    event("tomorrow", { kind: "dday", startDate: "2020-10-18" }),
    event("today", { kind: "dday", startDate: "2020-10-17" }),
    event("hidden", { kind: "dday", details: null }),
    event("regular"),
  ];
  expect(
    ddayOccurrences(events, 5, instant).map(({ event, dday }) => [
      event.id,
      dday?.label,
    ]),
  ).toEqual([
    ["today", "D-Day"],
    ["tomorrow", "D-1"],
  ]);
  expect(
    upcomingOccurrences(events, 5, instant).some(
      ({ event }) => event.id === "today",
    ),
  ).toBe(false);
});
it("CAL-02 CAL-13 SCN-CAL-8 이어지는 기간 일정은 내일 시작하는 시각 일정보다 위에 와요", () => {
  const events = [
    event("early", {
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      startTime: "01:00",
    }),
    event("ongoing", { startDate: "2026-10-16", endDate: "2026-10-19" }),
  ];
  expect(
    upcomingOccurrences(events, 5, instant).map(({ event }) => event.id),
  ).toEqual(["ongoing", "early"]);
});
