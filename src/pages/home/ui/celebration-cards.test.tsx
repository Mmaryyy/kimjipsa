import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as EventModule from "@/entities/event";
import type { CalendarEvent } from "@/entities/event";
import { CelebrationCards } from "./celebration-cards";
const { useDdayDismissals, dismiss } = vi.hoisted(() => ({
  useDdayDismissals: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useDdayDismissals,
  useDismissDdayCard: () => ({ mutate: dismiss, isPending: false }),
}));
const event: CalendarEvent = {
  id: "event",
  kind: "dday",
  ownerId: "owner",
  visibility: "shared",
  startDate: "2026-10-11",
  endDate: "2026-10-11",
  startTime: null,
  endTime: null,
  isAllDay: true,
  canEdit: true,
  canChangeVisibility: true,
  details: {
    title: "결혼기념일",
    place: "",
    memo: "",
    categoryId: "category",
    ddayStyle: "celebrate",
    celebrateMessage: "함께해서 행복해요",
  },
};
describe("CAL-16 SCN-CAL-10 당일 축하", () => {
  beforeEach(() => {
    dismiss.mockClear();
    useDdayDismissals.mockReturnValue({
      data: [],
      isError: false,
      isPending: false,
    });
  });
  it("등록한 해에는 주년 없이 문구를 보여 주고 닫음 저장을 요청해요", () => {
    render(
      <CelebrationCards
        events={[event]}
        instant={new Date("2026-10-11T12:00:00+09:00")}
      />,
    );
    expect(screen.getByRole("heading", { name: "결혼기념일" })).toBeVisible();
    expect(screen.getByText("함께해서 행복해요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "오늘 축하 닫기" }));
    expect(dismiss).toHaveBeenCalledWith("event");
  });
  it("닫은 연도에는 숨기고 다음 해에는 1주년으로 다시 보여 줘요", () => {
    useDdayDismissals.mockReturnValue({
      data: [{ event_id: "event", year: 2026 }],
      isError: false,
      isPending: false,
    });
    const { rerender } = render(
      <CelebrationCards
        events={[event]}
        instant={new Date("2026-10-11T12:00:00+09:00")}
      />,
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    rerender(
      <CelebrationCards
        events={[event]}
        instant={new Date("2027-10-11T12:00:00+09:00")}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "결혼기념일 1주년" }),
    ).toBeVisible();
  });
  it("당일이 아니거나 내용이 가려진 개인 D-day는 축하 화면에 노출하지 않아요", () => {
    const { rerender } = render(
      <CelebrationCards
        events={[event]}
        instant={new Date("2027-10-10T12:00:00+09:00")}
      />,
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    rerender(
      <CelebrationCards
        events={[{ ...event, visibility: "private", details: null }]}
        instant={new Date("2027-10-11T12:00:00+09:00")}
      />,
    );
    expect(screen.queryByText("결혼기념일")).not.toBeInTheDocument();
  });
  it("닫음 조회 실패도 재시도할 수 있어요", () => {
    const refetch = vi.fn();
    useDdayDismissals.mockReturnValue({
      isError: true,
      error: new Error("닫음 기록 조회 실패"),
      refetch,
    });
    render(
      <CelebrationCards
        events={[event]}
        instant={new Date("2026-10-11T12:00:00+09:00")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
