import { ConfirmTestProvider as ConfirmProvider } from "@/shared/ui/confirm-test-provider";
import type { ReactElement } from "react";
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
import type * as EventModule from "@/entities/event";
import {
  cleanup,
  fireEvent,
  render as renderWithoutConfirm,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./calendar-page";

const render = (ui: ReactElement) =>
  renderWithoutConfirm(ui, { wrapper: ConfirmProvider });
const { useEvents, useEventCategories } = vi.hoisted(() => ({
  useEvents: vi.fn(),
  useEventCategories: vi.fn(),
}));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useEvents,
  useEventCategories,
}));
vi.mock("./event-detail", () => ({ default: () => <p>상세 내용</p> }));
vi.mock("@/features/family", () => ({
  useFamily: () => ({
    data: { name: "우리 집", members: [] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("date=2026-10-16&view=day"),
  usePathname: () => "/calendar",
  useRouter: () => ({ replace: vi.fn() }),
}));
const refetch = vi.fn();
describe("CAL-01~05 SCN-CAL-1~3 일정 목록", () => {
  beforeEach(() => {
    useEvents.mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
      refetch,
    });
    useEventCategories.mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    });
  });
  afterEach(cleanup);
  it("로딩을 표시해요", () => {
    useEvents.mockReturnValue({ isPending: true, isError: false });
    render(<CalendarPage />);
    expect(
      screen.getByRole("group", { name: "하루 일정을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("빈 일 보기에는 시간대를 보여 주고 개인 일정 안내는 표시하지 않아요", () => {
    render(<CalendarPage />);
    expect(screen.getByText("08:00")).toBeVisible();
    expect(screen.queryByText(/은 시간만 보여요/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록" })).toBeVisible();
  });
  it("조회 실패를 빈 목록으로 표시하지 않고 재시도해요", () => {
    useEvents.mockReturnValue({
      isError: true,
      error: new Error("불러오기 실패"),
      refetch,
    });
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalled();
    expect(
      screen.queryByText("선택한 기간에 일정이 없어요."),
    ).not.toBeInTheDocument();
  });
  it("배우자 개인 일정은 상세를 여는 버튼이 없어요", () => {
    useEvents.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        {
          id: "private",
          ownerId: "spouse",
          visibility: "private",
          startDate: "2026-10-16",
          endDate: "2026-10-16",
          startTime: "15:00",
          endTime: "16:00",
          canChangeVisibility: false,
          isAllDay: false,
          canEdit: false,
          details: null,
        },
      ],
    });
    render(<CalendarPage />);
    expect(screen.getByText(/개인 일정/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /개인 일정/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("수정하기")).not.toBeInTheDocument();
  });
});

it("CAL-01 SCN-CAL-1 모바일 당기기는 기존 새 일정 시트를 열어요", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

  render(<CalendarPage />);
  const surface = document.querySelector('[data-od-id="calendar-main"]')!;
  fireEvent.touchStart(surface, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 40 }] });
  expect(screen.getByText("당겨서 일정 등록하기")).toBeVisible();
  const arrow = screen.getByText("당겨서 일정 등록하기").querySelector("svg")!;
  expect(arrow).toHaveAttribute("aria-hidden", "true");
  expect(arrow).not.toHaveClass("rotate-180");
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 90 }] });
  expect(screen.getByText("당겨서 일정 등록하기")).toBeVisible();
  expect(arrow).toHaveClass("rotate-180");
  fireEvent.touchEnd(surface, { touches: [] });

  expect(screen.getByRole("dialog", { name: "새 일정" })).toBeVisible();
  cleanup();
  vi.unstubAllGlobals();
});
