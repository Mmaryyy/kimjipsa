import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../api/type";
import {
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
  it("진행 중 기간 일정을 먼저 두고 지난 시작 시각을 제외하며 D-day를 개수에 포함해요", () => {
    const events = [
      event("past", { startTime: "10:00" }),
      event("future"),
      event("ongoing", { startDate: "2026-10-15", endDate: "2026-10-18" }),
      event("dday", {
        kind: "dday",
        isAllDay: true,
        startTime: null,
        endTime: null,
        startDate: "2020-10-18",
        endDate: "2020-10-18",
      }),
      event("later", { startDate: "2026-10-20", endDate: "2026-10-20" }),
    ];
    const upcoming = upcomingOccurrences(events, 3, instant);
    expect(upcoming.map(({ event }) => event.id)).toEqual([
      "ongoing",
      "future",
      "dday",
    ]);
    expect(upcoming[2].dday?.label).toBe("D-1");
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
      event(`event-${index}`),
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
