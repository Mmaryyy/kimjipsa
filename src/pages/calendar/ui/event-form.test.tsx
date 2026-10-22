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
  it("종일을 켰다가 끄면 시작 시각을 입력해야 저장해요", async () => {
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
    expect(
      screen.getByText("기본은 가족 모두가 함께 보는 공유 일정이에요."),
    ).toBeVisible();
    const allDay = screen.getByRole("switch", { name: "종일" });
    fireEvent.click(allDay);
    fireEvent.click(allDay);
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    expect(await screen.findByText("시작 시각을 입력해 주세요.")).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
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
    expect(screen.queryByLabelText("시작 시각")).not.toBeInTheDocument();
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

describe("CAL-01 CAL-02 SCN-CAL-1 P5.5 입력 방식", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => vi.stubGlobal("matchMedia", originalMatchMedia));

  function mockPointer(coarse: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(pointer: coarse)" && coarse,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  it("fine에서는 좁은 화면도 날짜와 시각을 직접 입력해요", () => {
    mockPointer(false);
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    expect(screen.getByLabelText("시작", { exact: true })).toHaveAttribute(
      "type",
      "date",
    );
    expect(screen.getByLabelText("시작 시각")).toHaveAttribute("type", "time");
  });

  it("직접 입력에서도 시작 시각을 옮기면 종료가 기존 길이를 유지해요", () => {
    mockPointer(false);
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("시작 시각"), {
      target: { value: "23:30" },
    });
    expect(screen.getByLabelText("종료 시각 (선택)")).toHaveValue("00:30");
    expect(screen.getByLabelText("종료", { exact: true })).toHaveValue(
      "2026-10-17",
    );
  });

  it("coarse에서는 폭과 관계없이 시트 여는 버튼을 보여요", () => {
    mockPointer(true);
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: "시작, 2026년 10월 16일, 오전 9:00" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByLabelText("시작 시각")).not.toBeInTheDocument();
  });

  it("새 일정은 다음 정시와 한 시간 뒤 종료를 채우고 시간 미정은 꺼져 있어요", () => {
    mockPointer(false);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T23:30:00+09:00"));
    try {
      render(<EventForm categories={categories} onSaved={() => {}} />);
      expect(screen.getByLabelText("시작", { exact: true })).toHaveValue(
        "2026-10-22",
      );
      expect(screen.getByLabelText("시작 시각")).toHaveValue("00:00");
      expect(screen.getByLabelText("종료 시각 (선택)")).toHaveValue("01:00");
      expect(
        screen.getByRole("switch", { name: "시간 미정" }),
      ).not.toBeChecked();
    } finally {
      vi.useRealTimers();
    }
  });

  it("시간 미정을 켠 동안 안내를 숨기고 끄면 빈 시작 시각 저장을 막아요", async () => {
    mockPointer(false);
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    const toggle = screen.getByRole("switch", { name: "시간 미정" });
    fireEvent.click(toggle);
    expect(
      screen.queryByText("시각을 정하지 않았다면 시간 미정을 켜 주세요."),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    expect(await screen.findByText("시작 시각을 입력해 주세요.")).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("시간 미정을 저장하고 다시 열면 스위치가 켜져 있어요", async () => {
    mockPointer(false);
    const form = render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "시간 미정" }));
    expect(screen.queryByLabelText("시작 시각")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: null,
          endTime: null,
          isAllDay: false,
        }),
      ),
    );
    form.unmount();
    render(
      <EventForm
        event={{ ...event, startTime: null, endTime: null }}
        categories={categories}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByRole("switch", { name: "시간 미정" })).toBeChecked();
  });

  it("종일과 시간 미정은 서로를 꺼요", () => {
    mockPointer(false);
    render(
      <EventForm event={event} categories={categories} onSaved={() => {}} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "종일" }));
    fireEvent.click(screen.getByRole("switch", { name: "시간 미정" }));
    expect(screen.getByRole("switch", { name: "종일" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "종일" }));
    expect(screen.getByRole("switch", { name: "시간 미정" })).not.toBeChecked();
  });
});
