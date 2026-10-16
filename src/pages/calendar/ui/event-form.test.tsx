import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  eventCategoryColors,
  type CalendarEvent,
  type EventCategory,
} from "@/entities/event";
import { EventForm } from "./event-form";
const { onSave } = vi.hoisted(() => ({
  onSave: vi.fn().mockResolvedValue("saved"),
}));
vi.mock("../model/use-event-editor", () => ({
  useEventEditor: () => ({ onSave }),
}));
const categories: EventCategory[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "우리집",
    color: Object.keys(eventCategoryColors)[0] as EventCategory["color"],
    sortOrder: 0,
  },
];
const event: CalendarEvent = {
  id: "event",
  ownerId: "owner",
  visibility: "shared",
  canEdit: true,
  canChangeVisibility: false,
  startDate: "2026-10-16",
  endDate: "2026-10-16",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  details: {
    title: "함께 일정",
    place: "",
    memo: "",
    categoryId: categories[0].id,
  },
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("CAL-01~03 SCN-CAL-1 일정 입력", () => {
  it("배우자의 공유 일정은 수정할 수 있지만 개인 전환 스위치는 없어요", () => {
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    expect(
      screen.queryByRole("switch", { name: "개인 일정" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장하기" })).toBeEnabled();
  });
  it("종일을 켰다가 꺼도 시각 없이 저장해요", async () => {
    render(
      <EventForm
        event={{ ...event, canChangeVisibility: true }}
        categories={categories}
        onSaved={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "개인 일정" }),
    ).toBeInTheDocument();
    const allDay = screen.getByRole("switch", { name: "종일" });
    fireEvent.click(allDay);
    fireEvent.click(allDay);
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: "2026-10-16",
          endDate: "2026-10-16",
          startTime: null,
          endTime: null,
          isAllDay: false,
        }),
      ),
    );
  });
});
