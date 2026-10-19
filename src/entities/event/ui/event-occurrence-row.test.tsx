import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../api/type";
import { EventOccurrenceRow } from "./event-occurrence-row";

const event: CalendarEvent = {
  id: "trip",
  kind: "event",
  ownerId: "me",
  visibility: "shared",
  startDate: "2026-10-16",
  endDate: "2026-10-18",
  startTime: "10:30",
  endTime: "11:30",
  isAllDay: false,
  canChangeVisibility: true,
  canEdit: true,
  details: {
    title: "여행",
    place: "",
    memo: "",
    categoryId: "family",
    ddayStyle: "normal",
    celebrateMessage: "",
  },
};

describe("CAL-02 CAL-07 기간 일정의 날짜별 시간 표시", () => {
  it.each([
    ["2026-10-16", false, "10:30"],
    ["2026-10-17", false, "종일"],
    ["2026-10-18", false, "종일"],
    ["2026-10-16", true, "종일"],
  ])("%s 날짜에는 짧은 시간만 보여 줘요", (date, isAllDay, label) => {
    render(
      <EventOccurrenceRow
        occurrence={{
          event: { ...event, isAllDay },
          startDate: event.startDate,
          endDate: event.endDate,
          dday: null,
        }}
        date={date}
        categories={[]}
      />,
    );
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(/2026-10-16 ~ 2026-10-18/)).toBeVisible();
    expect(screen.queryByText(/2026-10-16 10:30/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "여행" })).toBeVisible();
  });

  it("시각 없는 하루 일정은 시간 미정으로 표시해요", () => {
    render(
      <EventOccurrenceRow
        occurrence={{
          event: {
            ...event,
            endDate: event.startDate,
            startTime: null,
            endTime: null,
          },
          startDate: event.startDate,
          endDate: event.startDate,
          dday: null,
        }}
        categories={[]}
      />,
    );
    expect(screen.getByText("시간 미정")).toBeVisible();
  });
});
