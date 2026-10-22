vi.mock("@/widgets/calendar-view/ui/calendar-carousel", () => ({
  CalendarCarousel: ({
    date,
    renderPanel,
  }: {
    date: string;
    renderPanel: (date: string) => React.ReactNode;
  }) => renderPanel(date),
}));
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarView } from "./calendar-view";
const { location, useHolidays } = vi.hoisted(() => ({
  location: { search: "" },
  useHolidays: vi.fn(),
}));
vi.mock("@/entities/holiday", () => ({ useHolidays }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(location.search),
  usePathname: () => "/calendar",
  useRouter: () => ({ replace: vi.fn() }),
}));
const props = { events: [], categories: [], today: "2026-10-20" };
describe("CAL-17 공휴일 표시", () => {
  beforeEach(() => {
    location.search = "view=month&date=2026-10-01";
    useHolidays.mockReturnValue({
      isPending: false,
      names: {
        "2026-10-03": "개천절",
        "2026-10-09": "한글날",
      },
    });
  });
  it("월 칸에 빨간 숫자·이름과 공휴일을 포함한 접근성 이름이 있어요", () => {
    render(<CalendarView {...props} />);
    for (const name of ["개천절", "한글날"]) {
      const date = screen.getByRole("button", { name: new RegExp(name) });
      expect(date.children[1]).toHaveClass("text-[var(--sys-red-ic)]");
      expect(within(date).getByText(name)).toBeVisible();
    }
  });
  it.each([
    ["month", false],
    ["week", true],
  ])(
    "%s 보기에서 홈 %s의 선택한 공휴일도 빨간 숫자를 유지해요",
    (view, home) => {
      location.search = `view=${view}&date=2026-10-09`;
      render(<CalendarView {...props} home={home} />);
      const date = screen.getByRole("button", { name: /한글날/ });
      expect(date).toHaveAttribute("aria-pressed", "true");
      expect(date.children[1]).toHaveClass(
        "text-[var(--sys-red-ic)]",
        "bg-[var(--fill-secondary)]",
        "font-semibold",
      );
    },
  );
  it("홈 주간 스트립은 빨간 숫자와 접근성 이름만 보여 줘요", () => {
    location.search = "date=2026-10-09";
    render(<CalendarView {...props} home defaultView="week" />);
    const strip = screen.getByRole("navigation", { name: "이번 주" });
    const date = within(strip).getByRole("button", { name: /한글날/ });
    expect(date.children[1]).toHaveClass("text-[var(--sys-red-ic)]");
    expect(within(strip).queryByText("한글날")).not.toBeInTheDocument();
  });
  it.each(["week", "day"])("%s 머리에 이름을 보여 줘요", (view) => {
    location.search = `view=${view}&date=2026-10-09`;
    render(<CalendarView {...props} />);
    expect(
      screen.getByRole("heading", {
        name: view === "day" ? "10월 9일 금요일" : /10월 9일 금요일 · 한글날/,
      }),
    ).toBeVisible();
  });
  it.each(["month", "week", "day"])(
    "%s 목록 맨 위의 공휴일은 상세를 열지 않는 정적 행이에요",
    (view) => {
      location.search = `view=${view}&date=2026-10-09`;
      const onOpen = vi.fn();
      render(<CalendarView {...props} onOpen={onOpen} />);
      const row = screen.getByRole("listitem", { name: "한글날, 공휴일" });
      expect(row.parentElement?.firstElementChild).toBe(row);
      expect(within(row).getByText("종일")).toBeVisible();
      expect(within(row).getByText("공휴일")).toBeVisible();
      expect(within(row).queryByRole("button")).not.toBeInTheDocument();
      expect(within(row).queryByRole("link")).not.toBeInTheDocument();
      expect(onOpen).not.toHaveBeenCalled();
      if (view === "month") {
        expect(
          screen.getByRole("button", { name: /일정 0개, 한글날/ }),
        ).toBeVisible();
      }
    },
  );
  it("달 밖 공휴일 이름은 날짜처럼 회색이에요", () => {
    location.search = "view=month&date=2026-05-01";
    useHolidays.mockReturnValue({
      names: { "2026-06-06": "현충일" },
      isPending: false,
    });
    render(<CalendarView {...props} />);
    const day = screen.getByRole("button", { name: /현충일/ });
    expect(within(day).getByText("현충일")).toHaveClass(
      "text-[var(--label-tertiary)]",
    );
  });
  it.each(["month", "week", "day"])(
    "%s 첫 조회 중에는 일정 목록을 뒤늦게 밀지 않아요",
    (view) => {
      location.search = `view=${view}&date=2026-10-09`;
      useHolidays.mockReturnValue({ names: {}, isPending: true });
      const { rerender } = render(<CalendarView {...props} />);
      expect(
        screen.getByRole("group", { name: /불러오고 있어요/ }),
      ).toBeVisible();
      expect(
        screen.queryByText("등록된 일정이 없어요"),
      ).not.toBeInTheDocument();
      useHolidays.mockReturnValue({
        names: { "2026-10-09": "한글날" },
        isPending: false,
      });
      rerender(<CalendarView {...props} />);
      expect(
        screen.queryByRole("group", { name: /불러오고 있어요/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("listitem", { name: "한글날, 공휴일" }),
      ).toBeVisible();
    },
  );
  it("일 보기 제목은 날짜만 읽고 공휴일 이름은 목록에서 한 번만 읽어요", () => {
    location.search = "view=day&date=2026-10-09";
    render(<CalendarView {...props} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "10월 9일 금요일",
    );
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveAttribute(
      "aria-label",
    );
    const holidayName = screen.getByText("한글날");
    expect(
      screen.getByRole("listitem", { name: "한글날, 공휴일" }),
    ).toContainElement(holidayName);
  });
  it("홈 오늘 일정에는 공휴일 행을 넣지 않아요", () => {
    location.search = "date=2026-10-09";
    render(<CalendarView {...props} home defaultView="week" />);
    expect(
      screen.queryByRole("listitem", { name: "한글날, 공휴일" }),
    ).not.toBeInTheDocument();
  });
  it("두 해에 걸친 날짜 범위를 함께 조회해요", () => {
    location.search = "view=month&date=2026-12-31";
    render(<CalendarView {...props} />);
    expect(useHolidays).toHaveBeenCalledWith(2026, 2027);
  });
  it("공휴일 조회 중이거나 빈 목록이어도 달력을 보여 줘요", () => {
    useHolidays.mockReturnValue({ names: {}, isPending: false });
    render(<CalendarView {...props} />);
    expect(screen.getByRole("navigation", { name: "달력" })).toBeVisible();
    expect(screen.queryByText("개천절")).not.toBeInTheDocument();
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
  });
});

describe("CAL-07 CAL-17 토요일·오늘 표시", () => {
  it.each([
    ["2026-10-10", "text-[var(--accent-text)]"],
    ["2026-10-11", "text-[var(--sys-red-ic)]"],
    ["2026-10-03", "text-[var(--sys-red-ic)]"],
    ["2026-10-20", "text-foreground"],
  ])("오늘 %s는 요일 색·굵게·점선과 선택 채움을 함께 써요", (today, color) => {
    location.search = `view=month&date=${today}`;
    useHolidays.mockReturnValue({
      isPending: false,
      names: { "2026-10-03": "개천절" },
    });
    render(<CalendarView {...props} today={today} />);
    const button = screen.getByRole("button", { name: /오늘, 선택됨/ });
    expect(button).toHaveAttribute("aria-current", "date");
    expect(button.children[1]).toHaveClass(
      color,
      "font-bold",
      "border-[1.5px]",
      "border-dashed",
      "border-current",
      "size-6",
      "bg-[var(--fill-secondary)]",
    );
  });
});

describe("CAL-17 절기·잡절 표시", () => {
  beforeEach(() => {
    useHolidays.mockReturnValue({
      names: { "2026-05-05": "어린이날" },
      specialDays: {
        "2026-04-05": [{ date: "2026-04-05", name: "청명", kind: "solarTerm" }],
        "2026-04-06": [{ date: "2026-04-06", name: "한식", kind: "sundry" }],
        "2026-05-05": [{ date: "2026-05-05", name: "입하", kind: "solarTerm" }],
      },
      isPending: false,
    });
  });
  it("CAL-17 월 이름은 회색이고 숫자는 평일·일요일 색과 일정 개수를 유지해요", () => {
    location.search = "view=month&date=2026-04-06";
    render(<CalendarView {...props} />);
    const monday = screen.getByRole("button", {
      name: /4월 6일 월요일, 일정 0개, 한식/,
    });
    expect(monday).toHaveAttribute("data-holiday", "false");
    expect(monday.children[1]).toHaveClass("text-foreground");
    expect(within(monday).getByText("한식")).toHaveClass(
      "text-[var(--label-secondary)]",
    );
    const sunday = screen.getByRole("button", {
      name: /4월 5일 일요일, 일정 0개, 청명/,
    });
    expect(sunday.children[1]).toHaveClass("text-[var(--sys-red-ic)]");
  });
  it("CAL-17 겹친 날 칸에는 공휴일만 보이고 aria와 목록에는 둘 다 있어요", () => {
    location.search = "view=month&date=2026-05-05";
    render(<CalendarView {...props} />);
    const button = screen.getByRole("button", {
      name: /일정 0개, 어린이날, 입하/,
    });
    expect(within(button).getByText("어린이날")).toBeVisible();
    expect(within(button).queryByText("입하")).not.toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "어린이날, 공휴일" }),
    ).toBeVisible();
    const specialDay = screen.getByRole("listitem", { name: "입하 · 절기" });
    const holiday = screen.getByRole("listitem", { name: "어린이날, 공휴일" });
    expect(specialDay).toBeVisible();
    expect(within(specialDay).getByText("종일")).toBeVisible();
    expect(specialDay.parentElement).toBe(holiday.parentElement);
  });
  it.each(["week", "day"])(
    "CAL-17 %s 목록에 회색 정적 줄을 표시해요",
    (view) => {
      location.search = `view=${view}&date=2026-04-06`;
      render(<CalendarView {...props} />);
      const row = screen.getByRole("listitem", { name: "한식 · 잡절" });
      expect(within(row).getByText("종일")).toBeVisible();
      expect(within(row).getByText("한식 · 잡절")).toHaveClass(
        "text-[var(--label-secondary)]",
      );
      expect(row.querySelector(".rounded-full")).toHaveClass(
        "bg-[var(--label-secondary)]",
      );
      expect(within(row).queryByRole("button")).not.toBeInTheDocument();
      expect(within(row).queryByRole("link")).not.toBeInTheDocument();
      if (view === "week")
        expect(
          screen.getByRole("listitem", { name: "청명 · 절기" }),
        ).toBeVisible();
      else {
        const empty = screen.getByText("등록된 일정이 없어요");
        expect(empty).toBeVisible();
        expect(
          row.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    },
  );
  it("CAL-17 홈 오늘 일정에는 절기·잡절 행을 넣지 않아요", () => {
    location.search = "date=2026-04-06";
    render(<CalendarView {...props} home defaultView="week" />);
    expect(
      screen.queryByRole("listitem", { name: "한식 · 잡절" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
  });
});
