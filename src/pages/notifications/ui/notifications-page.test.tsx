import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Notifications from "@/entities/notification";
import { SkeletonStatus } from "@/shared/ui";
import { NotificationsPage } from "./notifications-page";
const {
  useNotifications,
  mutateAsync,
  replace,
  back,
  useSearchParams,
  refetch,
} = vi.hoisted(() => ({
  useNotifications: vi.fn(),
  mutateAsync: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  useSearchParams: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, back }),
  useSearchParams,
}));
vi.mock("@/entities/notification", async (original) => ({
  ...(await original<typeof Notifications>()),
  useNotifications,
  useMarkNotificationsRead: () => ({ mutateAsync, isPending: false }),
}));
const notification = {
  id: "notice",
  kind: "event_updated",
  payload: { eventId: "event", eventTitle: "치과 정기검진", actorName: "민호" },
  read_at: null,
  created_at: "2026-10-21T01:00:00Z",
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/?notifications=open");
  useSearchParams.mockReturnValue(new URLSearchParams("notifications=open"));
  mutateAsync.mockResolvedValue(null);
  useNotifications.mockReturnValue({
    data: [notification],
    isPending: false,
    isError: false,
    refetch,
  });
});
describe("CAL-09 알림 목록", () => {
  it.each(["", "notifications=closed"])(
    "SCN-CAL-5 쿼리가 '%s'이면 알림 시트를 열지 않아요",
    (query) => {
      useSearchParams.mockReturnValue(new URLSearchParams(query));
      render(<NotificationsPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(useNotifications).not.toHaveBeenCalled();
    },
  );
  it("SCN-CAL-5 notifications=open이면 알림 시트를 열어요", () => {
    render(<NotificationsPage />);
    expect(screen.getByRole("dialog", { name: "알림" })).toBeVisible();
  });
  it.each([null, "2026-10-21T02:00:00Z"])(
    "SCN-CAL-5 읽은 시각이 %s이면 안 읽음 안내를 구분해요",
    (readAt) => {
      useNotifications.mockReturnValue({
        data: [{ ...notification, read_at: readAt }],
      });
      render(<NotificationsPage />);
      const row = screen.getByRole("button", {
        name: /‘치과 정기검진’ 일정이 변경되었어요\./,
      });
      if (readAt === null) expect(row).toHaveAccessibleName(/^안 읽음:/);
      else expect(row).not.toHaveAccessibleName(/안 읽음:/);
    },
  );
  it.each(["닫기", "Escape"])(
    "SCN-CAL-5 %s로 닫으면 다른 쿼리는 유지해요",
    async (action) => {
      useSearchParams.mockReturnValue(
        new URLSearchParams("notifications=open&view=week"),
      );
      const { rerender } = render(<NotificationsPage />);
      if (action === "닫기") {
        fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      } else {
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      }
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/?view=week", { scroll: false }),
      );
      useSearchParams.mockReturnValue(new URLSearchParams("view=week"));
      rerender(<NotificationsPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it("SCN-CAL-5 홈에서 연 시트는 닫을 때 이전 기록으로 돌아가요", () => {
    window.history.replaceState({ notificationsOpened: true }, "");
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });
  it("SCN-CAL-5 알림을 읽은 다음 일정 상세로 이동해요", async () => {
    render(<NotificationsPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /‘치과 정기검진’ 일정이 변경되었어요\./,
      }),
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/calendar?event=event"),
    );
    expect(mutateAsync).toHaveBeenCalledWith({ id: "notice" });
  });
  it.each([
    ["event_deleted", /‘치과 정기검진’ 일정이 삭제되었어요\./],
    ["event_updated", /‘치과 정기검진’ 일정이 변경되었어요\./],
    [
      "event_participants_changed",
      /‘치과 정기검진’ 일정의 참가 인원이 변경되었어요\./,
    ],
  ])(
    "SCN-CAL-5 삭제된 일정의 %s 알림은 읽고 시트를 닫아요",
    async (kind, message) => {
      useNotifications.mockReturnValue({
        data: [
          {
            ...notification,
            kind,
            payload: { ...notification.payload, eventDeleted: true },
          },
        ],
      });
      render(<NotificationsPage />);
      fireEvent.click(screen.getByRole("button", { name: message }));
      await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/", { scroll: false }),
      );
      expect(back).not.toHaveBeenCalled();
    },
  );
  it("SCN-CAL-5 모두 읽음으로 전체를 읽어요", async () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({}));
  });
  it("SCN-CAL-5 읽음 저장이 실패하면 이동하지 않고 오류를 보여 줘요", async () => {
    mutateAsync.mockRejectedValue(new Error("읽음 저장 실패"));
    render(<NotificationsPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /‘치과 정기검진’ 일정이 변경되었어요\./,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "읽음 저장 실패",
    );
    expect(replace).not.toHaveBeenCalled();
  });
  it("SCN-CAL-5 빈 알림을 안내해요", () => {
    useNotifications.mockReturnValue({ data: [] });
    render(<NotificationsPage />);
    expect(screen.getByText("아직 알림이 없어요")).toBeVisible();
    expect(screen.getByRole("button", { name: "모두 읽음" })).toBeDisabled();
  });
  it("SCN-CAL-5 목록 모양의 로딩을 보여 줘요", () => {
    useNotifications.mockReturnValue({ isPending: true });
    render(
      <SkeletonStatus>
        <NotificationsPage />
      </SkeletonStatus>,
    );
    expect(
      screen.getByRole("group", { name: "알림을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("SCN-CAL-5 조회 오류를 없음으로 숨기지 않고 재시도해요", () => {
    useNotifications.mockReturnValue({
      isError: true,
      error: new Error("조회 실패"),
      refetch,
    });
    render(<NotificationsPage />);
    expect(screen.queryByText("아직 알림이 없어요")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
