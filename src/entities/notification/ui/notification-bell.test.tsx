import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";
const { unread } = vi.hoisted(() => ({ unread: { count: 0 } }));
vi.mock("../model/use-notifications", () => ({
  useNotifications: () => ({
    data: Array.from({ length: unread.count }, () => ({ read_at: null })),
  }),
}));
describe("CAL-09 SCN-CAL-5 홈 알림 종", () => {
  it("최근 목록의 안 읽은 개수를 안내하고 점을 보여 줘요", () => {
    unread.count = 30;
    const { container } = render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "알림" }),
    ).toHaveAccessibleDescription("안 읽은 알림 30개");
    expect(container.querySelector("span[aria-hidden]")).toBeInTheDocument();
  });
  it("0개이면 점과 개수 안내를 숨겨요", () => {
    unread.count = 0;
    const { container } = render(<NotificationBell />);
    expect(screen.getByRole("button", { name: "알림" })).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(
      container.querySelector("span[aria-hidden]"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/안 읽은 알림/)).not.toBeInTheDocument();
  });
});
