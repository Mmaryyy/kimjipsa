import { describe, expect, it } from "vitest";
import { todoSchedule, todoToday } from "./todo-date.utils";

describe("CAL-18 / SCN-CAL-11 할 일 미루기", () => {
  const task = { due_on: "2026-11-20", completed_at: null };

  it.each([
    ["2026-11-20T14:59:59Z", "2026-11-20", null],
    ["2026-11-20T15:00:00Z", "2026-11-21", 2],
    ["2026-11-21T14:59:59Z", "2026-11-21", 2],
    ["2026-11-21T15:00:00Z", "2026-11-22", 3],
  ])(
    "한국 자정에 표시일과 지난 일수를 바꾼다 (%s)",
    (instant, date, overdueDays) => {
      expect(todoSchedule(task, todoToday(new Date(instant)))).toEqual({
        date,
        overdueDays,
      });
      expect(task.due_on).toBe("2026-11-20");
    },
  );

  it("마감 전에 완료한 할 일은 마감일에 표시한다", () => {
    const today = "2026-11-22";
    expect(
      todoSchedule({ ...task, completed_at: "2026-11-19T00:00:00Z" }, today),
    ).toEqual({
      date: task.due_on,
      overdueDays: null,
    });
  });

  it("마감일 없는 할 일은 오늘 또는 완료한 한국 날짜에 표시한다", () => {
    const undated = { ...task, due_on: null };
    expect(todoSchedule(undated, "2026-11-23")).toEqual({
      date: "2026-11-23",
      overdueDays: null,
    });
    expect(
      todoSchedule(
        { ...undated, completed_at: "2026-11-21T15:30:00Z" },
        "2026-11-23",
      ),
    ).toEqual({
      date: "2026-11-22",
      overdueDays: null,
    });
  });

  it("금요일 마감 할 일을 일요일에 완료하면 월요일에도 일요일 칸에 3일째로 남는다", () => {
    const completed = { ...task, completed_at: "2026-11-22T02:00:00Z" };
    const expected = { date: "2026-11-22", overdueDays: 3 };
    expect(todoSchedule(completed, "2026-11-22")).toEqual(expected);
    expect(todoSchedule(completed, "2026-11-23")).toEqual(expected);
    expect(
      todoSchedule({ ...completed, completed_at: null }, "2026-11-23"),
    ).toEqual({
      date: "2026-11-23",
      overdueDays: 4,
    });
  });

  it.each([
    ["2026-11-21T14:59:59Z", "2026-11-21", 2],
    ["2026-11-21T15:30:00Z", "2026-11-22", 3],
  ])(
    "완료 시각 %s을 한국 날짜로 계산한다",
    (completed_at, date, overdueDays) => {
      expect(todoSchedule({ ...task, completed_at }, "2026-11-23")).toEqual({
        date,
        overdueDays,
      });
    },
  );
});
