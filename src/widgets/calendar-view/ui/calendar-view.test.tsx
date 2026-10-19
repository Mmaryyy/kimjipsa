import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "@/entities/event";
import { CalendarView } from "./calendar-view";
const { replace, location } = vi.hoisted(() => ({
  replace: vi.fn(),
  location: { search: "" },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(location.search),
  usePathname: () => "/calendar",
  useRouter: () => ({ replace }),
}));
const props = { events: [], categories: [], today: "2026-12-31" };
describe("CAL-07 SCN-CAL-8 월·주·일 URL 상태", () => {
  beforeEach(() => {
    location.search = "";
    replace.mockClear();
  });
  it("월 보기의 날짜를 선택하면 목록 날짜를 URL에 기록해요", () => {
    render(<CalendarView {...props} />);
    expect(screen.getByRole("navigation", { name: "달력" })).toBeVisible();
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "12월 30일 수요일, 일정 0개" }),
    );
    expect(replace).toHaveBeenCalledWith(
      "/calendar?view=month&date=2026-12-30",
      { scroll: false },
    );
  });
  it("URL 날짜와 보기를 복원하고 다음 달과 일 보기 이동을 기록해요", () => {
    location.search = "view=month&date=2026-12-31&filter=keep";
    render(<CalendarView {...props} />);
    expect(
      screen.getByRole("heading", { name: "2026년 12월", level: 1 }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/calendar?view=month&date=2027-01-31&filter=keep",
      { scroll: false },
    );
    fireEvent.click(screen.getByRole("radio", { name: "일" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/calendar?view=day&date=2026-12-31&filter=keep",
      { scroll: false },
    );
  });
  it.each([
    ["month", "이전 달", "다음 달"],
    ["week", "이전 주", "다음 주"],
    ["day", "전날", "다음 날"],
  ])("%s 보기의 이동 단위를 안내해요", (view, previous, next) => {
    location.search = `view=${view}&date=2026-12-31`;
    render(<CalendarView {...props} />);
    expect(screen.getByRole("button", { name: previous })).toBeVisible();
    expect(screen.getByRole("button", { name: next })).toBeVisible();
  });
  it("홈 주간 스트립은 일요일부터 시작하고 선택 날짜를 안내해요", () => {
    render(<CalendarView {...props} home defaultView="week" />);
    const strip = screen.getByRole("navigation", { name: "이번 주" });
    expect(within(strip).getAllByRole("button")[0]).toHaveAccessibleName(
      "12월 27일 일요일, 일정 0개",
    );
    expect(screen.getByRole("region", { name: "오늘 일정" })).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it("잘못된 URL은 오늘과 기본 보기로 대체해요", () => {
    location.search = "view=invalid&date=2026-02-30";
    render(<CalendarView {...props} defaultView="day" />);
    expect(screen.getByRole("radio", { name: "일" })).toBeChecked();
    expect(screen.getByText("08:00")).toBeVisible();
    expect(screen.queryByLabelText("선택 날짜")).not.toBeInTheDocument();
  });
});

const timelineEvent: CalendarEvent = {
  id: "dentist",
  kind: "event",
  ownerId: "partner",
  visibility: "shared",
  startDate: "2026-10-14",
  endDate: "2026-10-14",
  startTime: "10:30",
  endTime: "11:30",
  isAllDay: false,
  canEdit: true,
  canChangeVisibility: true,
  details: {
    title: "치과 정기검진",
    place: "치과 병원",
    memo: "검진 메모",
    categoryId: "clinic",
    ddayStyle: "normal",
    celebrateMessage: "",
  },
};

function timelineSlot(label: string) {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`${label} 시간 줄이 없어요`);
  return within(row);
}

describe("CAL-07 일간·주간 일정 구성", () => {
  beforeEach(() => {
    location.search = "view=day&date=2026-10-14";
    replace.mockClear();
  });

  it("빈 날은 안내를 보여 주고 빈 시간 줄은 화면 읽기 도구에서 숨겨요", () => {
    render(<CalendarView {...props} />);
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
    for (let hour = 8; hour <= 22; hour++) {
      const label = `${String(hour).padStart(2, "0")}:00`;
      const row = screen.getByText(label).closest("li");
      expect(row).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText(label)).toBeVisible();
    }
  });

  it("선택 날짜 제목과 08시부터 22시까지 시간 슬롯을 보여 줘요", () => {
    const onOpen = vi.fn();
    render(
      <CalendarView {...props} events={[timelineEvent]} onOpen={onOpen} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "10월 14일 수요일" }),
    ).toBeVisible();
    for (let hour = 8; hour <= 22; hour++) {
      expect(
        screen.getByText(`${String(hour).padStart(2, "0")}:00`),
      ).toBeVisible();
    }
    const event = timelineSlot("10:00").getByRole("button", {
      name: "10:30 치과 정기검진",
    });
    expect(screen.getByText("일정 1개")).toBeInTheDocument();
    expect(screen.getByText("10:00").closest("li")).not.toHaveAttribute(
      "aria-hidden",
    );
    fireEvent.click(event);
    expect(onOpen).toHaveBeenCalledWith("dentist");
    expect(screen.queryByText("치과 병원")).not.toBeInTheDocument();
    expect(screen.queryByText("검진 메모")).not.toBeInTheDocument();
    expect(screen.queryByText("둘 다")).not.toBeInTheDocument();
  });

  it("같은 시간의 일정을 쌓고 개인 일정은 시각과 이름을 보여 줘요", () => {
    render(
      <CalendarView
        {...props}
        events={[
          timelineEvent,
          { ...timelineEvent, id: "second", startTime: "10:45" },
          {
            ...timelineEvent,
            id: "private",
            startTime: "10:15",
            visibility: "private",
            details: null,
            canEdit: false,
          },
        ]}
        ownerNames={{ partner: "민호" }}
        onOpen={vi.fn()}
      />,
    );
    const slot = timelineSlot("10:00");
    expect(slot.getAllByRole("button")).toHaveLength(2);
    expect(slot.getByText("10:15 개인 일정 · 민호님")).toBeVisible();
    expect(slot.queryByLabelText("개인 일정")).not.toBeInTheDocument();
  });

  it("종일·기간 중간 날짜·D-day와 시간 미정을 시간 슬롯 밖에 보여 줘요", () => {
    render(
      <CalendarView
        {...props}
        events={[
          { ...timelineEvent, id: "all-day", isAllDay: true },
          { ...timelineEvent, id: "period", startDate: "2026-10-13" },
          { ...timelineEvent, id: "dday", kind: "dday" },
          { ...timelineEvent, id: "unknown", startTime: null, endTime: null },
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(timelineSlot("종일").getAllByRole("button")).toHaveLength(3);
    expect(timelineSlot("종일").getByText(/D-Day/)).toBeVisible();
    expect(timelineSlot("시간 미정").getByRole("button")).toHaveTextContent(
      "치과 정기검진",
    );
    expect(timelineSlot("10:00").queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-10-13/)).not.toBeInTheDocument();
  });

  it("범위 밖 일정은 앞뒤 구역에 두고 22시 일정은 마지막 슬롯에 넣어요", () => {
    render(
      <CalendarView
        {...props}
        events={[
          { ...timelineEvent, id: "early", startTime: "07:30" },
          { ...timelineEvent, id: "last", startTime: "22:30" },
          { ...timelineEvent, id: "late", startTime: "23:30" },
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(timelineSlot("08:00 이전").getByRole("button")).toHaveTextContent(
      "07:30",
    );
    expect(timelineSlot("22:00").getByRole("button")).toHaveTextContent(
      "22:30",
    );
    expect(timelineSlot("23:00 이후").getByRole("button")).toHaveTextContent(
      "23:30",
    );
  });

  it("주 보기는 날짜 묶음과 상세 열기 동작을 유지해요", () => {
    location.search = "view=week&date=2026-10-14";
    const onOpen = vi.fn();
    render(
      <CalendarView {...props} events={[timelineEvent]} onOpen={onOpen} />,
    );
    const day = screen.getByRole("region", { name: "2026-10-14" });
    expect(
      within(day).getByRole("heading", { name: "10월 14일 수요일" }),
    ).toBeVisible();
    fireEvent.click(within(day).getByRole("button", { name: "치과 정기검진" }));
    expect(onOpen).toHaveBeenCalledWith("dentist");
    expect(within(day).getByText("10:30")).toBeVisible();
    expect(within(day).queryByText(/2026-10-14/)).not.toBeInTheDocument();
  });
});
