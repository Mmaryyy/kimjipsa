import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../api/type";
import { EventOccurrenceRow } from "./event-occurrence-row";
import { nextDday } from "../lib/dday.utils";

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
    ["2026-10-18", false, "~11:30"],
    ["2026-10-16", true, "종일"],
    ["2026-10-17", true, "종일"],
    ["2026-10-18", true, "종일"],
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
    expect(
      screen.getByText(
        isAllDay || date === event.endDate ? "공유" : "공유 · 11:30까지",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/2026-10-16 ~ 2026-10-18/),
    ).not.toBeInTheDocument();
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
    expect(screen.getByText("공유")).toBeVisible();
  });
});

describe("CAL-03 CAL-04 일정 보조 정보 순서", () => {
  it.each([
    ["shared", true, "카페", "공유 · 카페 · 11:30까지"],
    ["private", true, "카페", "개인 일정 · 나 · 카페 · 11:30까지"],
    ["private", false, "", "개인 일정 · 민호 님 · 11:30까지"],
  ] as const)(
    "%s 편집 가능 %s 장소 %s",
    (visibility, canEdit, place, metadata) => {
      render(
        <EventOccurrenceRow
          occurrence={{
            event: {
              ...event,
              visibility,
              canEdit,
              details: canEdit ? { ...event.details!, place } : null,
            },
            startDate: event.startDate,
            endDate: event.endDate,
            dday: null,
          }}
          categories={[]}
          ownerNames={{ me: "민호" }}
        />,
      );

      expect(screen.getByText(metadata)).toBeVisible();
      if (visibility === "private") {
        if (canEdit) {
          expect(screen.queryByLabelText("개인 일정")).not.toBeInTheDocument();
        } else {
          expect(screen.getByLabelText("개인 일정")).toBeVisible();
        }
      }
    },
  );
});

describe("CAL-06 CAL-16 SCN-CAL-9 D-day 라벨 표시", () => {
  describe.each([true, false])("날짜 표시 %s", (showDdayDate) => {
    it.each([
      ["2026-10-19", "D-Day", "font-bold", "text-[color:var(--accent-text)]"],
      ["2026-10-20", "D-1", "font-semibold", "text-[color:var(--accent-text)]"],
      ["2026-10-24", "D-5", "font-semibold", "text-[color:var(--accent-text)]"],
      ["2026-10-26", "D-7", "font-semibold", "text-[color:var(--accent-text)]"],
      ["2026-10-27", "D-8", "font-normal", "text-foreground"],
      ["2027-10-16", "D-362", "font-normal", "text-foreground"],
    ])("%s의 %s를 단계별로 표시해요", (date, label, weight, color) => {
      const dday = nextDday(date, new Date("2026-10-19T12:00:00+09:00"));
      render(
        <EventOccurrenceRow
          occurrence={{
            event: { ...event, kind: "dday", startDate: date, endDate: date },
            startDate: dday.date,
            endDate: dday.date,
            dday,
          }}
          categories={[]}
          showDdayDate={showDdayDate}
        />,
      );

      const ddayBadge = screen.getByText(label);
      const ddayLabel = ddayBadge.parentElement;
      expect(ddayLabel).toHaveClass(
        "block",
        "shrink-0",
        "text-left",
        "whitespace-nowrap",
        "tabular-nums",
        "w-[4.5em]",
        weight,
        color,
        showDdayDate
          ? "text-[length:var(--type-title-size)]"
          : "text-[length:var(--type-caption-size)]",
      );
      expect(ddayLabel).not.toHaveClass("text-[color:var(--error-text)]");
      expect(ddayLabel).not.toHaveClass("text-[color:var(--info-text)]");
      if (label === "D-Day") {
        expect(ddayBadge).toHaveClass(
          "-ml-2",
          "inline-block",
          "rounded-control",
          "bg-[var(--accent-soft)]",
          "px-2",
          "py-0.5",
        );
      } else {
        expect(ddayBadge).not.toHaveClass("bg-[var(--accent-soft)]");
      }
    });
  });
});

it.each(["2026-10-19", "2026-10-24", "2027-10-16"])(
  "CAL-06 SCN-CAL-9 날짜별 D-day 행에는 %s의 카운트다운을 표시하지 않아요",
  (date) => {
    const dday = nextDday(date, new Date("2026-10-19T12:00:00+09:00"));
    render(
      <EventOccurrenceRow
        occurrence={{
          event: { ...event, kind: "dday", startDate: date, endDate: date },
          startDate: dday.date,
          endDate: dday.date,
          dday,
        }}
        categories={[]}
        showDdayCountdown={false}
      />,
    );
    expect(screen.getByRole("link", { name: "여행" })).toBeVisible();
    expect(screen.queryByText(/^D-(?:Day|\d+)$/)).not.toBeInTheDocument();
  },
);

it("CAL-02 CAL-13 SCN-CAL-8 내일로 묶은 진행 중 일정은 종일과 종료 시각을 보여요", () => {
  render(
    <EventOccurrenceRow
      occurrence={{
        event,
        startDate: "2026-10-17",
        endDate: event.endDate,
        dday: null,
      }}
      categories={[]}
    />,
  );
  expect(screen.getByText("종일")).toBeVisible();
  expect(screen.getByText("공유 · 11:30까지")).toBeVisible();
  expect(screen.queryByText(/2026-10-16 ~ 2026-10-18/)).not.toBeInTheDocument();
  expect(screen.queryByText("10:30")).not.toBeInTheDocument();
});
