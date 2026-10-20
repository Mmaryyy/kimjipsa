import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarCarousel } from "./calendar-carousel";
import { CalendarView } from "./calendar-view";

const { holidayState } = vi.hoisted(() => ({
  holidayState: {
    names: {} as Record<string, string>,
    isPending: false,
    pendingYears: [] as number[],
  },
}));
vi.mock("@/entities/holiday", () => ({ useHolidays: () => holidayState }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("view=day&date=2026-12-31"),
  usePathname: () => "/calendar",
}));

const { api, handlers, options } = vi.hoisted(() => ({
  api: {
    scrollTo: vi.fn(),
    rootNode: () => ({ clientWidth: 600 }),
    selectedScrollSnap: vi.fn(() => 1),
    on: vi.fn(),
    off: vi.fn(),
  },
  handlers: new Map<string, () => void>(),
  options: vi.fn(),
}));
vi.mock("embla-carousel-react", () => ({
  default: (value: unknown) => {
    options(value);
    return [vi.fn(), api];
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  holidayState.names = {};
  holidayState.pendingYears = [];
  holidayState.isPending = false;
  handlers.clear();
  api.selectedScrollSnap.mockReturnValue(1);
  api.on.mockImplementation((event, callback) => {
    handlers.set(event, callback);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("CAL-07 SCN-CAL-8 스와이프 선택", () => {
  it.each(["month", "week", "day"] as const)(
    "%s 선택 즉시 날짜를 이동하고 넘김 완료 뒤 가운데로 돌아와요",
    (view) => {
      const onDateChange = vi.fn();
      const nextDate = {
        month: "2027-01-31",
        week: "2027-01-07",
        day: "2027-01-01",
      }[view];
      const renderPanel = (date: string) => <button>{date}</button>;
      const { rerender } = render(
        <CalendarCarousel
          date="2026-12-31"
          view={view}
          onDateChange={onDateChange}
          renderPanel={renderPanel}
        />,
      );
      expect(screen.getAllByRole("button")).toHaveLength(1);
      act(() => handlers.get("settle")?.());
      expect(onDateChange).not.toHaveBeenCalled();
      api.selectedScrollSnap.mockReturnValue(2);
      act(() => handlers.get("select")?.());
      expect(onDateChange).toHaveBeenCalledExactlyOnceWith(nextDate);
      api.scrollTo.mockClear();
      rerender(
        <CalendarCarousel
          date={nextDate}
          view={view}
          onDateChange={onDateChange}
          renderPanel={renderPanel}
        />,
      );
      expect(api.scrollTo).not.toHaveBeenCalled();
      act(() => handlers.get("settle")?.());
      expect(api.scrollTo).toHaveBeenCalledWith(1, true);
      api.selectedScrollSnap.mockReturnValue(0);
      act(() => handlers.get("select")?.());
      expect(onDateChange).toHaveBeenLastCalledWith("2026-12-31");
    },
  );
  it.each([
    [2, 0, "2026-12-20"],
    [0, 2, "2026-08-20"],
  ])(
    "settle 전 %s → %s 연속 넘김도 같은 방향으로 이동해요",
    (first, second, expected) => {
      const onDateChange = vi.fn();
      render(
        <CalendarCarousel
          date="2026-10-20"
          view="month"
          onDateChange={onDateChange}
          renderPanel={(date) => date}
        />,
      );
      for (const index of [first, second]) {
        api.selectedScrollSnap.mockReturnValue(index);
        act(() => handlers.get("select")?.());
      }
      expect(onDateChange).toHaveBeenLastCalledWith(expected);
      expect(onDateChange).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    ["2026-10-20", "month"],
    ["2026-11-20", "week"],
  ] as const)(
    "넘기는 도중 외부 날짜 %s·보기 %s 변경은 가운데로 돌아와요",
    (date, view) => {
      const props = {
        onDateChange: vi.fn(),
        renderPanel: (value: string) => <button>{value}</button>,
      };
      const { rerender } = render(
        <CalendarCarousel {...props} date="2026-10-20" view="month" />,
      );
      api.selectedScrollSnap.mockReturnValue(2);
      act(() => handlers.get("select")?.());
      expect(props.onDateChange).toHaveBeenCalledExactlyOnceWith("2026-11-20");
      api.scrollTo.mockClear();
      // Reflect the parent's swipe date update before another user action.
      rerender(<CalendarCarousel {...props} date="2026-11-20" view="month" />);
      expect(api.scrollTo).not.toHaveBeenCalled();
      rerender(<CalendarCarousel {...props} date={date} view={view} />);
      expect(api.scrollTo).toHaveBeenCalledWith(1, true);
      expect(screen.getByRole("button")).toHaveTextContent(date);
    },
  );
  it.each([
    [-1000, 0, "2026-11-20"],
    [1000, 2, "2026-09-20"],
  ])(
    "한 장보다 긴 마우스 이동 %s도 끈 방향으로 이동해요",
    (clientX, index, expected) => {
      const onDateChange = vi.fn();
      render(
        <CalendarCarousel
          date="2026-10-20"
          view="month"
          onDateChange={onDateChange}
          renderPanel={(date) => date}
        />,
      );
      const config = options.mock.lastCall?.[0];
      config.watchDrag(api, new MouseEvent("mousedown", { clientX: 0 }));
      fireEvent.mouseMove(document, { clientX });
      api.selectedScrollSnap.mockReturnValue(index);
      act(() => handlers.get("select")?.());
      expect(onDateChange).toHaveBeenLastCalledWith(expected);
    },
  );
  it("처음부터 현재 장 높이를 쓰고 짧은 장으로 넘기는 동안 이전 높이를 유지해요", () => {
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.textContent === "2026-09-20") return 600;
        return this.textContent === "2026-10-20" ? 400 : 300;
      });
    const { container } = render(
      <CalendarCarousel
        date="2026-10-20"
        view="month"
        onDateChange={vi.fn()}
        renderPanel={(date) => date}
      />,
    );
    expect(container.firstChild).toHaveStyle({ height: "400px" });
    api.selectedScrollSnap.mockReturnValue(2);
    act(() => handlers.get("select")?.());
    expect(container.firstChild).toHaveStyle({ height: "400px" });
    act(() => handlers.get("settle")?.());
    expect(container.firstChild).toHaveStyle({ height: "300px" });
    height.mockRestore();
  });
  it("실제 달력에서 select 즉시 제목·안내·URL을 갱신해요", () => {
    const replace = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
    render(<CalendarView events={[]} categories={[]} today="2026-12-31" />);
    api.selectedScrollSnap.mockReturnValue(2);
    act(() => handlers.get("select")?.());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "1월 1일 금요일",
    );
    expect(screen.getByRole("status")).toHaveTextContent("1월 1일 금요일");
    expect(replace).toHaveBeenLastCalledWith(
      null,
      "",
      "/calendar?view=day&date=2027-01-01",
    );
    replace.mockRestore();
  });
  it("이웃 연도 조회 중인 패널은 미리 로딩을 보여 주고 선택 뒤에도 유지해요", () => {
    holidayState.pendingYears = [2027];
    holidayState.isPending = true;
    const { container, rerender } = render(
      <CalendarView events={[]} categories={[]} today="2026-12-31" />,
    );
    const label = { name: "일정을 준비하고 있어요" };
    expect(screen.queryByRole("status", label)).not.toBeInTheDocument();
    expect(
      container.querySelector('[aria-label="일정을 준비하고 있어요"]'),
    ).toBeInTheDocument();
    api.selectedScrollSnap.mockReturnValue(2);
    act(() => handlers.get("select")?.());
    expect(screen.getByRole("status", label)).toBeVisible();
    holidayState.pendingYears = [];
    holidayState.isPending = false;
    holidayState.names = { "2027-01-01": "신정" };
    rerender(<CalendarView events={[]} categories={[]} today="2026-12-31" />);
    expect(
      screen.getByRole("listitem", { name: "신정, 공휴일" }),
    ).toBeVisible();
    expect(screen.queryByRole("status", label)).not.toBeInTheDocument();
  });
  it("동작 줄이기에서는 손을 놓자마자 선택 장으로 이동해요", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(
      <CalendarCarousel
        date="2026-10-20"
        view="month"
        onDateChange={vi.fn()}
        renderPanel={(date) => date}
      />,
    );
    api.scrollTo.mockClear();
    api.selectedScrollSnap.mockReturnValue(2);
    act(() => handlers.get("pointerUp")?.());
    expect(api.scrollTo).toHaveBeenCalledWith(2, true);
  });
  it("동작 줄이기는 애니메이션 길이가 0이고 세로 스크롤을 허용해요", () => {
    const { container } = render(
      <CalendarCarousel
        date="2026-10-20"
        view="month"
        onDateChange={vi.fn()}
        renderPanel={(date) => date}
      />,
    );
    expect(options).toHaveBeenCalledWith(
      expect.objectContaining({
        breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
      }),
    );
    expect(container.firstChild).toHaveClass("touch-pan-y", "touch-pinch-zoom");
  });
});
