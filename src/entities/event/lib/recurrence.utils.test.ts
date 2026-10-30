import { describe, expect, it } from "vitest";
import {
  expandRecurrence,
  splitRecurrence,
  type RecurringDates,
} from "./recurrence.utils";
const weekly: RecurringDates = {
  startDate: "2026-10-02",
  endDate: "2026-10-04",
  recurrence: "weekly",
};
describe("CAL-14 반복 회차·예외·분할", () => {
  it("매월 31일은 없는 날짜를 건너뛰어요", () => {
    const event: RecurringDates = {
      startDate: "2026-01-31",
      endDate: "2026-01-31",
      recurrence: "monthly",
    };
    expect(
      expandRecurrence(event, "2026-01-01", "2026-05-31").map(
        (entry) => entry.startDate,
      ),
    ).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
  });
  it("매년 2월 29일은 윤년에만 보여요", () => {
    const event: RecurringDates = {
      startDate: "2024-02-29",
      endDate: "2024-02-29",
      recurrence: "yearly",
    };
    expect(
      expandRecurrence(event, "2025-01-01", "2032-12-31").map(
        (entry) => entry.startDate,
      ),
    ).toEqual(["2028-02-29", "2032-02-29"]);
  });
  it("매일 반복도 원래 기간을 유지하고 조회 시작일에 걸친 회차를 포함해요", () => {
    expect(
      expandRecurrence(
        { ...weekly, recurrence: "daily" },
        "2026-10-04",
        "2026-10-04",
      ).map((entry) => entry.startDate),
    ).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
  });
  it("취소한 회차는 빠지고 옮긴 회차는 새 기간에서 한 번 보여요", () => {
    const exceptions = [
      { originalDate: "2026-10-09", replacement: null },
      {
        originalDate: "2026-10-16",
        replacement: {
          ...weekly,
          startDate: "2026-11-02",
          endDate: "2026-11-04",
        },
      },
    ];
    expect(
      expandRecurrence(weekly, "2026-10-09", "2026-10-18", exceptions),
    ).toEqual([]);
    expect(
      expandRecurrence(weekly, "2026-11-02", "2026-11-04", exceptions).map(
        (entry) => entry.originalDate,
      ),
    ).toEqual(["2026-10-16"]);
  });
  it("분할 경계 전 회차를 보존하고 첫 회차는 규칙 자체를 바꿔요", () => {
    const replacement = {
      ...weekly,
      startDate: "2026-10-16",
      endDate: "2026-10-18",
    };
    const split = splitRecurrence(weekly, "2026-10-16", replacement);
    expect(
      expandRecurrence(split.before!, "2026-10-01", "2026-11-01").map(
        (entry) => entry.originalDate,
      ),
    ).toEqual(["2026-10-02", "2026-10-09"]);
    expect(
      expandRecurrence(split.after, "2026-10-01", "2026-10-31").map(
        (entry) => entry.originalDate,
      ),
    ).toEqual(["2026-10-16", "2026-10-23", "2026-10-30"]);
    expect(
      splitRecurrence(weekly, weekly.startDate, replacement).before,
    ).toBeNull();
    expect(() => splitRecurrence(weekly, "2026-10-03", replacement)).toThrow();
  });
});
