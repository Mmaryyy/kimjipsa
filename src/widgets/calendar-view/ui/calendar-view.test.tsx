vi.mock("@/widgets/calendar-view/ui/calendar-carousel", () => ({
  CalendarCarousel: ({
    date,
    renderPanel,
  }: {
    date: string;
    renderPanel: (date: string) => React.ReactNode;
  }) => renderPanel(date),
}));
vi.mock("@/entities/holiday", () => ({
  useHolidays: () => ({ names: {}, isPending: false }),
}));
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
    vi.spyOn(window.history, "replaceState").mockImplementation(replace);
  });
  it("월 보기의 날짜를 선택하면 목록 날짜를 URL에 기록해요", () => {
    render(<CalendarView {...props} />);
    expect(screen.getByRole("navigation", { name: "달력" })).toBeVisible();
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "12월 30일 수요일, 일정 0개" }),
    );
    expect(replace).toHaveBeenCalledWith(
      null,
      "",
      "/calendar?view=month&date=2026-12-30",
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
      null,
      "",
      "/calendar?view=month&date=2027-01-31&filter=keep",
    );
    fireEvent.click(screen.getByRole("radio", { name: "일" }));
    expect(replace).toHaveBeenLastCalledWith(
      null,
      "",
      "/calendar?view=day&date=2027-01-31&filter=keep",
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
  it.each([
    ["month", "이전 달", "다음 달", "2026-11-30", "2026-12-30"],
    ["week", "이전 주", "다음 주", "2026-12-24", "2026-12-31"],
    ["day", "전날", "다음 날", "2026-12-30", "2026-12-31"],
  ])(
    "%s 헤더는 이전·오늘·다음 버튼으로 날짜를 이동해요",
    (view, previous, next, previousDate, nextDate) => {
      location.search = `view=${view}&date=2026-12-31`;
      render(<CalendarView {...props} />);
      const previousButton = screen.getByRole("button", { name: previous });
      const nextButton = screen.getByRole("button", { name: next });
      const todayButton = screen.getByRole("button", { name: "오늘" });
      expect(previousButton.nextElementSibling).toBe(todayButton);
      expect(todayButton.nextElementSibling).toBe(nextButton);
      fireEvent.click(previousButton);
      expect(replace).toHaveBeenLastCalledWith(
        null,
        "",
        `/calendar?view=${view}&date=${previousDate}`,
      );
      fireEvent.click(nextButton);
      expect(replace).toHaveBeenLastCalledWith(
        null,
        "",
        `/calendar?view=${view}&date=${nextDate}`,
      );
    },
  );
  it("주 제목과 접근성 이름에 목요일 기준 주차를 표시해요", () => {
    location.search = "view=week&date=2027-01-02";
    const onAdd = vi.fn();
    render(<CalendarView {...props} onAdd={onAdd} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "2026년 12월 5주차" }),
    ).toHaveTextContent("2026년 12월 5주차");
    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
    expect(onAdd).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "오늘" }));
    expect(replace).toHaveBeenLastCalledWith(
      null,
      "",
      "/calendar?view=week&date=2026-12-31",
    );
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
  describe.each([
    ["month", false],
    ["week", true],
  ])("%s 보기 홈 주간 스트립 %s", (view, home) => {
    it.each(["2026-12-30", "2026-12-31"])(
      "%s 선택 시 오늘과 선택 날짜를 구분해요",
      (selected) => {
        location.search = `view=${view}&date=${selected}`;
        render(<CalendarView {...props} home={home} defaultView="week" />);
        const today = screen.getByRole("button", {
          name: /12월 31일 목요일, 일정 0개, 오늘/,
        });
        const chosen = screen.getByRole("button", {
          name: /선택됨/,
        });
        expect(today).toHaveAttribute("aria-current", "date");
        expect(today).toHaveAttribute(
          "aria-pressed",
          String(selected === props.today),
        );
        expect(chosen).toHaveAttribute("aria-pressed", "true");
        expect(chosen.children[1]).toHaveClass(
          "bg-[var(--fill-secondary)]",
          selected === props.today ? "font-bold" : "font-semibold",
        );
        if (selected !== props.today) {
          expect(today.children[1]).toHaveClass(
            "text-foreground",
            "font-bold",
            "border-dashed",
          );
          expect(today.children[1]).not.toHaveClass(
            "bg-[var(--fill-secondary)]",
          );
          expect(chosen.children[1]).toHaveClass("text-foreground");
          expect(chosen).not.toHaveAttribute("aria-current");
        } else {
          expect(today).toBe(chosen);
          expect(today.children[1]).toHaveClass(
            "text-foreground",
            "border-dashed",
          );
        }
      },
    );
  });
  it("선택한 일요일은 빨강을, 달 밖 날짜는 보조색을 유지해요", () => {
    location.search = "view=month&date=2026-12-27";
    render(<CalendarView {...props} />);
    const sunday = screen.getByRole("button", { name: /12월 27일.*선택됨/ });
    expect(sunday.children[1]).toHaveClass(
      "bg-[var(--fill-secondary)]",
      "text-[var(--sys-red-ic)]",
      "font-semibold",
    );
    const outside = screen.getByRole("button", { name: /11월 29일/ });
    expect(outside.children[1]).toHaveClass("text-[var(--label-tertiary)]");
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
    vi.spyOn(window.history, "replaceState").mockImplementation(replace);
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
    expect(screen.queryByText("공유")).not.toBeInTheDocument();
  });

  it.each(["09:00", "07:30", "23:30"])(
    "CAL-02 마지막 날은 종료 시각 %s의 시간 줄에 표시해요",
    (endTime) => {
      render(
        <CalendarView
          {...props}
          events={[{ ...timelineEvent, startDate: "2026-10-13", endTime }]}
          onOpen={vi.fn()}
        />,
      );
      const slot =
        endTime < "08:00"
          ? "08:00 이전"
          : endTime >= "23:00"
            ? "23:00 이후"
            : `${endTime.slice(0, 2)}:00`;
      expect(timelineSlot(slot).getByRole("button")).toHaveTextContent(
        `~${endTime} 치과 정기검진`,
      );
      expect(screen.queryByText("종일")).not.toBeInTheDocument();
    },
  );

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
    expect(slot.getByText("10:15 개인 일정 · 민호 님")).toBeVisible();
    expect(slot.queryByLabelText("개인 일정")).not.toBeInTheDocument();
  });

  it("종일·기간 중간 날짜·D-day와 시간 미정을 시간 슬롯 밖에 보여 줘요", () => {
    render(
      <CalendarView
        {...props}
        events={[
          { ...timelineEvent, id: "all-day", isAllDay: true },
          {
            ...timelineEvent,
            id: "period",
            startDate: "2026-10-13",
            endDate: "2026-10-15",
          },
          { ...timelineEvent, id: "dday", kind: "dday" },
          { ...timelineEvent, id: "unknown", startTime: null, endTime: null },
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(timelineSlot("종일").getAllByRole("button")).toHaveLength(3);
    expect(
      timelineSlot("종일").queryByText(/D-(?:Day|\d+)/),
    ).not.toBeInTheDocument();
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

describe("CAL-06 CAL-07 SCN-CAL-8 SCN-CAL-9 날짜별 D-day", () => {
  it.each(["month", "week", "day"])(
    "%s 보기에는 카운트다운 없이 제목과 주년을 보여 주고 상세를 열어요",
    (view) => {
      location.search = `view=${view}&date=2026-10-14`;
      const onOpen = vi.fn();
      render(
        <CalendarView
          {...props}
          events={[{ ...timelineEvent, kind: "dday", startDate: "2025-10-14" }]}
          onOpen={onOpen}
        />,
      );
      expect(screen.queryByText(/D-(?:Day|\d+)/)).not.toBeInTheDocument();
      expect(screen.getByText("1주년")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: /치과 정기검진/ }));
      expect(onOpen).toHaveBeenCalledWith("dentist");
    },
  );
});

describe("CAL-07 P4.12 SCN-CAL-8 달력 섹션 로딩", () => {
  it.each(["month", "week"])(
    "%s 로딩 중 날짜 버튼은 일정 개수를 단정하지 않아요",
    (view) => {
      location.search = `view=${view}&date=2026-12-31`;
      render(<CalendarView {...props} home loading />);
      const navigation = screen.getByRole("navigation");
      for (const button of within(navigation).getAllByRole("button")) {
        expect(button.getAttribute("aria-label")).not.toContain("일정 0개");
      }
    },
  );
  it("늦게 온 기본 보기가 사용자가 고른 날짜와 보기를 덮어쓰지 않아요", () => {
    location.search = "";
    const { rerender } = render(
      <CalendarView {...props} home loading defaultView="week" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "12월 30일 수요일" }));
    rerender(<CalendarView {...props} home defaultView="month" />);
    expect(screen.getByRole("navigation", { name: "이번 주" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /12월 30일.*선택됨/ }),
    ).toHaveAttribute("aria-pressed", "true");
    location.search = "view=month&date=2027-01-15";
    rerender(<CalendarView {...props} home defaultView="month" />);
    expect(screen.getByRole("navigation", { name: "달력" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /1월 15일.*선택됨/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("월 그리드의 날짜 칸 수를 로딩 뒤에도 유지해요", () => {
    location.search = "view=month&date=2026-12-31";
    const { rerender } = render(<CalendarView {...props} loading />);
    const before = within(
      screen.getByRole("navigation", { name: "달력" }),
    ).getAllByRole("button").length;
    expect(screen.queryByText("등록된 일정이 없어요")).not.toBeInTheDocument();
    rerender(<CalendarView {...props} />);
    expect(
      within(screen.getByRole("navigation", { name: "달력" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(before);
  });
  it.each([
    ["week", "이번 주 일정을 불러오고 있어요"],
    ["day", "하루 일정을 불러오고 있어요"],
  ])("%s 보기에는 해당 목록 스켈레톤을 보여 줘요", (view, label) => {
    location.search = `view=${view}&date=2026-12-31`;
    render(<CalendarView {...props} loading />);
    expect(screen.getByRole("group", { name: label })).toBeVisible();
    expect(screen.queryByText("등록된 일정이 없어요")).not.toBeInTheDocument();
  });
});
