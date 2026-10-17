import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
describe("CAL-07 월·주·일 URL 상태", () => {
  beforeEach(() => {
    location.search = "";
    replace.mockClear();
  });
  it.each(["month", "week", "day"] as const)(
    "%s 뷰에서 일정이 없어도 달력과 빈 상태를 보여 줘요",
    (view) => {
      location.search = `view=${view}&date=2026-12-31`;
      render(<CalendarView {...props} />);
      expect(screen.getByRole("region", { name: "달력" })).toBeVisible();
      expect(screen.getByText("선택한 기간에 일정이 없어요.")).toBeVisible();
    },
  );
  it("URL 날짜와 뷰를 복원하고 다음 달 이동과 뷰 변경도 URL에 기록해요", () => {
    location.search = "view=month&date=2026-12-31&filter=keep";
    render(<CalendarView {...props} />);
    expect(screen.getByLabelText("선택 날짜")).toHaveValue("2026-12-31");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/calendar?view=month&date=2027-01-31&filter=keep",
      { scroll: false },
    );
    fireEvent.click(screen.getByRole("radio", { name: "일간" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/calendar?view=day&date=2026-12-31&filter=keep",
      { scroll: false },
    );
  });
  it("잘못된 URL은 오늘과 홈 기본 뷰로 대체해요", () => {
    location.search = "view=invalid&date=2026-02-30";
    render(<CalendarView {...props} defaultView="day" />);
    expect(screen.getByLabelText("선택 날짜")).toHaveValue("2026-12-31");
    expect(
      screen.getByRole("region", { name: "2026-12-31 일정" }),
    ).toBeVisible();
  });
});
