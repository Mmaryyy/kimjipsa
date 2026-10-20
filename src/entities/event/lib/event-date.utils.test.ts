import { describe, expect, it } from "vitest";
import { eventSchema } from "../model/event.schema";
import {
  calendarWeekTitle,
  eventDateInput,
  eventTimeLabel,
} from "./event-date.utils";
const input = {
  title: "일정",
  place: "",
  memo: "",
  categoryId: "00000000-0000-4000-8000-000000000001",
  visibility: "shared",
  startDate: "2026-10-16",
  endDate: "2026-10-16",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
};
describe("CAL-01~02 SCN-CAL-1 날짜와 선택 시각", () => {
  it("기기 시간대와 관계없이 서울 날짜를 구해요", () => {
    expect(eventDateInput("2026-10-15T15:30:00Z")).toBe("2026-10-16");
  });
  it.each([
    [null, null],
    ["09:00", null],
    [null, "10:00"],
    ["09:00", "10:00"],
  ])("시작 %s·종료 %s를 각각 선택할 수 있어요", (startTime, endTime) => {
    expect(
      eventSchema.safeParse({ ...input, startTime, endTime }).success,
    ).toBe(true);
  });
  it("같은 날 역순과 같은 시각, 날짜 역순을 거절해요", () => {
    for (const endTime of ["08:00", "09:00"]) {
      expect(eventSchema.safeParse({ ...input, endTime }).success).toBe(false);
    }
    expect(
      eventSchema.safeParse({ ...input, endDate: "2026-10-15" }).success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({
        ...input,
        endDate: "2026-10-17",
        endTime: "08:00",
      }).success,
    ).toBe(true);
  });
  it("종일은 시각을 비우고, 하루 일정은 날짜를 반복하지 않아요", () => {
    const event = { ...input, startTime: null, endTime: null, isAllDay: true };
    expect(eventSchema.safeParse(event).success).toBe(true);
    expect(
      eventSchema.safeParse({ ...event, startTime: "09:00" }).success,
    ).toBe(false);
    expect(eventTimeLabel(event)).toBe("종일");
    expect(eventTimeLabel({ ...event, endDate: "2026-10-17" })).toBe(
      "2026-10-16 ~ 2026-10-17 · 종일",
    );
    expect(eventTimeLabel({ ...event, isAllDay: false })).toBe("시간 미정");
  });
});

describe("CAL-07 목요일 기준 주 보기 제목", () => {
  it.each([
    ["2026-09-27", "2026년 10월 1주차"],
    ["2026-10-03", "2026년 10월 1주차"],
    ["2026-10-04", "2026년 10월 2주차"],
    ["2026-10-31", "2026년 10월 5주차"],
    ["2026-11-01", "2026년 11월 1주차"],
    ["2026-12-27", "2026년 12월 5주차"],
    ["2027-01-01", "2026년 12월 5주차"],
    ["2027-01-02", "2026년 12월 5주차"],
    ["2027-01-03", "2027년 1월 1주차"],
    ["2028-02-29", "2028년 3월 1주차"],
  ])("%s의 연월과 주차를 목요일로 정해요", (date, expected) => {
    expect(calendarWeekTitle(date)).toBe(expected);
  });
});
