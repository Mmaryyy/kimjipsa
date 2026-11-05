vi.mock("../cart-summary", () => ({ default: () => null }));
vi.mock("../inventory-summary", () => ({ default: () => null }));
vi.mock("@/entities/notification", () => ({
  NotificationBell: () => <span aria-label="알림" />,
}));
vi.mock("@/entities/holiday", () => ({
  useHolidays: () => ({ names: {}, isPending: false }),
}));
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as EventModule from "@/entities/event";
import type * as UserModule from "@/entities/user";
import { SkeletonStatus } from "@/shared/ui";
import HomeSchedule from ".";
const { useEvents, useEventCategories, useHomeSettings } = vi.hoisted(() => ({
  useEvents: vi.fn(),
  useEventCategories: vi.fn(),
  useHomeSettings: vi.fn(),
}));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useEvents,
  useEventCategories,
  useCalendarClock: () => new Date("2026-10-17T12:00:00+09:00"),
  useDdayDismissals: () => ({ data: [], isPending: false, isError: false }),
  useDismissDdayCard: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/entities/user", async (original) => ({
  ...(await original<typeof UserModule>()),
  useHomeSettings,
}));
vi.mock("@/features/family", () => ({
  useFamily: () => ({
    data: { name: "우리 집", members: [] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
}));
const refetch = vi.fn();
describe("CAL-06 CAL-07 CAL-13 ACC-12 SCN-CAL-8~9 홈 상태", () => {
  beforeEach(() => {
    refetch.mockClear();
    useEvents.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch,
    });
    useEventCategories.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch,
    });
    useHomeSettings.mockReturnValue({
      data: { homeView: "day", upcomingEnabled: true, upcomingCount: 5 },
      isPending: false,
      isError: false,
      refetch,
    });
  });
  it("홈 달력과 위젯의 로딩을 보여 줘요", () => {
    useEvents.mockReturnValue({ isPending: true });
    render(
      <SkeletonStatus>
        <HomeSchedule />
      </SkeletonStatus>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "화면을 불러오고 있어요",
    );
    expect(
      screen.getByRole("group", { name: "오늘 일정을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("일정 없음과 D-day 없음, 다가오는 일정 없음을 안내해요", () => {
    render(<HomeSchedule />);
    expect(screen.getByText("등록된 일정이 없어요")).toBeVisible();
    expect(screen.getByText("다가오는 일정이 없어요.")).toBeVisible();
    expect(screen.getByText("등록한 D-day가 없어요.")).toBeVisible();
  });
  it.each([useEvents, useEventCategories, useHomeSettings])(
    "조회 실패를 없음으로 숨기지 않고 재시도해요",
    (query) => {
      query.mockReturnValue({
        isError: true,
        error: new Error("조회하지 못했어요"),
        refetch,
      });
      render(<HomeSchedule />);
      expect(
        screen.queryByText("다가오는 일정이 없어요."),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
      expect(refetch).toHaveBeenCalledOnce();
    },
  );
  it("위젯을 꺼도 오늘 일정과 D-day는 유지해요", () => {
    useHomeSettings.mockReturnValue({
      data: { homeView: "day", upcomingEnabled: false, upcomingCount: 3 },
      isPending: false,
      isError: false,
    });
    render(<HomeSchedule />);
    expect(screen.getByRole("region", { name: "오늘 일정" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "D-day" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "다가오는 일정" }),
    ).not.toBeInTheDocument();
  });
});
