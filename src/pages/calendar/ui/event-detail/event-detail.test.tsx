import { eventCategoryColors } from "@/entities/event";
import type * as EventModule from "@/entities/event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventDetail from "./";
const { useEvent, useEventCategories, deleteEvent } = vi.hoisted(() => ({
  useEvent: vi.fn(),
  useEventCategories: vi.fn(),
  deleteEvent: vi.fn(),
}));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useEvent,
  useEventCategories,
  deleteEvent,
}));
const familyMembers = vi.hoisted(() => ({
  members: [
    { user_id: "me", display_name: "지수" },
    { user_id: "spouse", display_name: "민호" },
  ],
}));
vi.mock("@/features/family", () => ({
  useFamily: () => ({ data: familyMembers }),
}));
vi.mock("@/features/account", () => ({
  useAccount: () => ({ data: { userId: "me" } }),
}));
const refetch = vi.fn();
function renderDetail() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EventDetail
        id="event"
        onClose={vi.fn()}
        editing={false}
        onEditingChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
describe("CAL-12 SCN-CAL-7 상세와 삭제 확인", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    familyMembers.members = [
      { user_id: "me", display_name: "지수" },
      { user_id: "spouse", display_name: "민호" },
    ];
    useEvent.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        id: "event",
        kind: "event",
        startDate: "2026-10-16",
        endDate: "2026-10-16",
        startTime: "15:00",
        endTime: "16:00",
        isAllDay: false,
        visibility: "shared",
        canEdit: true,
        details: {
          title: "병원 예약",
          place: "",
          memo: "",
          categoryId: "category",
        },
      },
    });
    useEventCategories.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        {
          id: "category",
          name: "병원",
          color: Object.keys(eventCategoryColors)[0],
        },
      ],
    });
    deleteEvent.mockResolvedValue(null);
  });
  afterEach(cleanup);
  it("일정 제목이 있는 확인창에서 취소하면 삭제하지 않아요", () => {
    renderDetail();
    expect(screen.getByText("공유 일정")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "‘병원 예약’ 일정을 삭제할까요?",
    );
    fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    expect(deleteEvent).not.toHaveBeenCalled();
  });
  it("공유 일정 삭제는 배우자에게도 알려 준다고 안내해요", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "삭제한 일정은 되돌릴 수 없어요.",
    );
  });
  it("구성원이 여럿이어도 되돌릴 수 없다고 안내해요", () => {
    familyMembers.members.push({ user_id: "third", display_name: "가족" });
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "삭제한 일정은 되돌릴 수 없어요.",
    );
  });
  it("개인 일정 삭제는 되돌릴 수 없다고 안내해요", () => {
    // The fixture's visibility is the only difference from a shared event.
    useEvent.mockReturnValue({
      ...useEvent(),
      data: { ...useEvent().data, visibility: "private" },
    });
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "삭제한 일정은 되돌릴 수 없어요.",
    );
  });
  it("확인 버튼을 눌러야 삭제해요", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "일정 삭제" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제하기" }));
    await waitFor(() =>
      expect(deleteEvent).toHaveBeenCalledWith("event", undefined),
    );
  });
  it("상세 로딩을 표시해요", () => {
    useEvent.mockReturnValue({ isPending: true, isError: false });
    renderDetail();
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "일정을 불러오고 있어요",
    );
  });
  it("없는 일정은 빈 상태를 표시해요", () => {
    useEvent.mockReturnValue({ isPending: false, isError: false, data: null });
    renderDetail();
    expect(
      screen.getByText("일정을 찾을 수 없거나 내용을 볼 수 없어요."),
    ).toBeInTheDocument();
  });
  it("상세 오류는 재시도할 수 있어요", () => {
    useEvent.mockReturnValue({
      isError: true,
      error: new Error("상세 실패"),
      refetch,
    });
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalled();
  });
});
