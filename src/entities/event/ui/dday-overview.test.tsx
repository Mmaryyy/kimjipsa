import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../api/type";
import { calendarDdayLimit } from "../model/calendar.constants";
import { DdayOverview } from "./dday-overview";

const instant = new Date("2026-10-19T12:00:00+09:00");
function dday(id: string, date: string): CalendarEvent {
  return {
    id,
    kind: "dday",
    ownerId: "me",
    visibility: "shared",
    startDate: date,
    endDate: date,
    startTime: null,
    endTime: null,
    isAllDay: true,
    canEdit: true,
    canChangeVisibility: true,
    details: {
      title: id,
      place: "",
      memo: "",
      categoryId: "family",
      ddayStyle: "celebrate",
      celebrateMessage: "",
    },
  };
}

describe("CAL-06 CAL-16 SCN-CAL-9 예정 D-day 목록", () => {
  it("오늘과 반복 기념일을 포함해 가까운 5개까지만 보여 주고 상세를 열어요", () => {
    const onOpen = vi.fn();
    render(
      <DdayOverview
        instant={instant}
        categories={[]}
        limit={calendarDdayLimit}
        onOpen={onOpen}
        events={[
          dday("지난 기념일", "2025-10-16"),
          dday("다섯 번째", "2026-11-03"),
          dday("반복 기념일", "2025-10-24"),
          dday("네 번째", "2026-11-01"),
          dday("오늘 기념일", "2026-10-19"),
          dday("세 번째", "2026-10-30"),
          { ...dday("개인 일정", "2026-10-20"), details: null },
          { ...dday("일반 일정", "2026-10-20"), kind: "event" },
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(
      rows.map((row) => within(row).getByRole("button").textContent),
    ).toEqual([
      "오늘 기념일",
      "반복 기념일",
      "세 번째",
      "네 번째",
      "다섯 번째",
    ]);
    expect(within(rows[0]).getByText("D-Day")).toBeVisible();
    expect(within(rows[1]).getByText("D-5")).toBeVisible();
    expect(within(rows[1]).getByText(/1주년/)).toBeVisible();
    expect(screen.queryByText("지난 기념일")).not.toBeInTheDocument();
    fireEvent.click(within(rows[1]).getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("반복 기념일");
  });

  it("적은 일정은 있는 만큼 보여 주고 지난 날짜는 다음 해로 계산해요", () => {
    render(
      <DdayOverview
        instant={instant}
        categories={[]}
        limit={calendarDdayLimit}
        events={[dday("지난 기념일", "2025-10-16")]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("D-362")).toBeVisible();
  });

  it("D-day가 없으면 빈 목록 대신 안내를 보여 줘요", () => {
    render(
      <DdayOverview
        instant={instant}
        categories={[]}
        events={[]}
        limit={calendarDdayLimit}
      />,
    );
    expect(screen.getByText("등록한 D-day가 없어요.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
