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
  kind: "event",
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
    ddayStyle: "normal",
    celebrateMessage: "",
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

describe("CAL-06 CAL-16 SCN-CAL-9~10 D-day 등록", () => {
  it("기준 날짜와 종류·축하 문구를 저장하고 숨긴 시간·기간은 비워요", async () => {
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "일정 종류" }), {
      target: { value: "dday" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "D-day 종류" }), {
      target: { value: "celebrate" },
    });
    fireEvent.change(screen.getByLabelText("축하 문구 (선택)"), {
      target: { value: "축하해요" },
    });
    fireEvent.change(screen.getByLabelText("시작", { exact: true }), {
      target: { value: "2020-10-11" },
    });
    expect(
      screen.queryByLabelText("종료", { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("시작 시각 (선택)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("종료 시각 (선택)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "dday",
          ddayStyle: "celebrate",
          celebrateMessage: "축하해요",
          startDate: "2020-10-11",
          endDate: "2020-10-11",
          isAllDay: true,
          startTime: null,
          endTime: null,
        }),
      ),
    );
  });
});

describe("CAL-11 SCN-CAL-5 알림 시점 입력", () => {
  it("기본 30분 전을 보여 주고 없음으로 바꿔 저장해요", async () => {
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    const reminder = screen.getByRole("combobox", { name: "알림" });
    expect(reminder).toHaveValue("30");
    fireEvent.change(reminder, { target: { value: "none" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ remindBefore: null }),
      ),
    );
  });
});
