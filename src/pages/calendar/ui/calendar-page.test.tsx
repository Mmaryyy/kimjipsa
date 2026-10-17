import type * as EventModule from "@/entities/event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./calendar-page";
const { useEvents, useEventCategories } = vi.hoisted(() => ({
  useEvents: vi.fn(),
  useEventCategories: vi.fn(),
}));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useEvents,
  useEventCategories,
}));
vi.mock("./event-detail", () => ({ EventDetail: () => <p>상세 내용</p> }));
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
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "일정을 불러오고 있어요",
    );
  });
  it("빈 목록을 안내해요", () => {
    render(<CalendarPage />);
    expect(
      screen.getByText("선택한 기간에 일정이 없어요."),
    ).toBeInTheDocument();
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
    expect(screen.getByText("개인 일정")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "개인 일정" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("수정하기")).not.toBeInTheDocument();
  });
});
