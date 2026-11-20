import { ConfirmTestProvider as ConfirmProvider } from "@/shared/ui/confirm-test-provider";
import type { ReactElement } from "react";
vi.mock("@/widgets/calendar-view/ui/calendar-carousel", () => ({
  CalendarCarousel: ({
    date,
    renderPanel,
  }: {
    date: string;
    renderPanel: (date: string) => React.ReactNode;
  }) => renderPanel(date),
}));
vi.mock("@/entities/holiday", () => ({
  useHolidays: () => ({ names: {}, isPending: false }),
}));
import type * as EventModule from "@/entities/event";
import type * as TodoModule from "@/entities/todo";
import {
  cleanup,
  fireEvent,
  render as renderWithoutConfirm,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/shared/ui";
import { CalendarPage } from "./calendar-page";

const render = (ui: ReactElement) => {
  const client = new QueryClient();
  return renderWithoutConfirm(ui, {
    wrapper: ({ children }) => (
      <ConfirmProvider>
        <ToastProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </ToastProvider>
      </ConfirmProvider>
    ),
  });
};
const { useEvents, useEventCategories, useEvent, deleteEvent, navigation } =
  vi.hoisted(() => ({
    useEvent: vi.fn(),
    deleteEvent: vi.fn(),
    navigation: { search: "date=2026-10-16&view=day" },
    useEvents: vi.fn(),
    useEventCategories: vi.fn(),
  }));
vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  useEvents,
  useCalendarClock: () => new Date("2026-11-20T03:00:00Z"),
  useEvent,
  deleteEvent,
  useEventCategories,
}));
const { useTodos, mutateTodo } = vi.hoisted(() => ({
  useTodos: vi.fn(),
  mutateTodo: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/entities/todo", async (original) => ({
  ...(await original<typeof TodoModule>()),
  useTodos,
  useTodoWrite: () => ({ mutateAsync: mutateTodo, isPending: false }),
}));
vi.mock("./event-detail", () => ({ default: () => <p>상세 내용</p> }));
vi.mock("@/features/family", () => ({
  useFamily: () => ({
    data: { name: "우리 집", members: [] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => "/calendar",
  useRouter: () => ({ replace: vi.fn() }),
}));
const refetch = vi.fn();
beforeEach(() => {
  useTodos.mockReturnValue({
    data: { items: [], userId: "me" },
    isPending: false,
    isError: false,
    error: null,
  });
});

const undatedTodo: TodoModule.Todo = {
  id: "10000000-0000-4000-8000-000000000001",
  owner_id: "spouse",
  title: "택배 반품",
  due_on: null,
  visibility: "shared",
  completed_at: null,
  completed_by: null,
  created_at: "2026-11-18T01:00:00.000Z",
  updated_at: "2026-11-18T01:00:00.000Z",
};

it("CAL-18 SCN-CAL-11 일정 본문에서 할 일을 보고 같은 시트로 수정해요", async () => {
  navigation.search = "date=2026-11-20&view=month";
  useEvents.mockReturnValue({ data: [] });
  useEventCategories.mockReturnValue({ data: [] });
  const todo = undatedTodo;
  useTodos.mockReturnValue({ data: { userId: "me", items: [todo] } });
  render(<CalendarPage />);
  const section = screen.getByRole("region", { name: "11월 20일 금요일" });
  expect(
    screen.queryByRole("region", { name: "할 일" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "등록" })).toHaveLength(1);
  expect(
    screen.queryByRole("radio", { name: "할 일" }),
  ).not.toBeInTheDocument();
  const calendar = screen.getByRole("navigation", { name: "달력" });
  expect(
    calendar.compareDocumentPosition(section) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(within(section).getByRole("button", { name: "택배 반품" }));
  const dialog = screen.getByRole("dialog", { name: "할 일 수정" });
  const form = within(dialog);
  expect(form.getByRole("combobox", { name: "일정 종류" })).toBeDisabled();
  expect(form.getByRole("combobox", { name: "일정 종류" })).toHaveValue("todo");
  expect(
    form.queryByRole("switch", { name: "개인 할 일" }),
  ).not.toBeInTheDocument();
  fireEvent.change(form.getByLabelText("제목"), {
    target: { value: "반품 보내기" },
  });
  fireEvent.click(form.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(mutateTodo).toHaveBeenCalledWith({
    action: "save",
    id: todo.id,
    item: { title: "반품 보내기", due_on: null, visibility: "shared" },
  });
  expect(screen.getByText("할 일을 수정했어요")).toBeVisible();
});

it("CAL-18 SCN-CAL-11 할 일을 표시일에 정렬하고 완료한 날에 남겨요", () => {
  navigation.search = "date=2026-11-20&view=month";
  useEvents.mockReturnValue({ data: [] });
  useEventCategories.mockReturnValue({ data: [] });
  const dueToday = {
    ...undatedTodo,
    id: "due",
    title: "세탁하기",
    due_on: "2026-11-20",
  };
  const overdue = {
    ...undatedTodo,
    id: "late",
    title: "관리비 내기",
    due_on: "2026-11-18",
  };
  const older = {
    ...overdue,
    id: "older",
    title: "청소하기",
    due_on: "2026-11-17",
  };
  const items = [undatedTodo, dueToday, overdue, older];
  useTodos.mockReturnValue({ data: { userId: "me", items } });
  const { rerender } = render(<CalendarPage />);
  const today = within(
    screen.getByRole("region", { name: "11월 20일 금요일" }),
  );
  const titles = () =>
    within(today.getByRole("list"))
      .getAllByRole("button")
      .map((row) => row.textContent);
  expect(titles()).toEqual([
    "청소하기",
    "관리비 내기",
    "세탁하기",
    "택배 반품",
  ]);
  expect(today.getByText("4일째")).toBeVisible();

  const tomorrow = () =>
    screen.getByRole("button", { name: /^11월 21일 토요일/ });
  const todayButton = () =>
    screen.getByRole("button", { name: /^11월 20일 금요일,/ });
  fireEvent.click(tomorrow());
  expect(
    screen.queryByRole("button", { name: "택배 반품" }),
  ).not.toBeInTheDocument();
  fireEvent.click(todayButton());

  const currentDay = within(
    screen.getByRole("region", { name: "11월 20일 금요일" }),
  );
  fireEvent.click(
    currentDay.getByRole("checkbox", { name: "관리비 내기 완료" }),
  );
  expect(mutateTodo).toHaveBeenCalledWith({
    action: "set_done",
    id: overdue.id,
    done: true,
  });
  const completed = { ...overdue, completed_at: "2026-11-20T03:00:00Z" };
  useTodos.mockReturnValue({
    data: { userId: "me", items: [undatedTodo, dueToday, completed, older] },
  });
  rerender(<CalendarPage />);
  expect(
    currentDay.getByRole("checkbox", { name: "관리비 내기 완료" }),
  ).toBeChecked();
  const completedButton = currentDay.getByRole("button", {
    name: "관리비 내기",
  });
  const completedTitle = within(completedButton).getByText("관리비 내기");
  expect(completedTitle).toHaveClass("line-through");
  const rows = within(currentDay.getByRole("list")).getAllByRole("listitem");
  expect(rows.at(-1)).toContainElement(completedButton);
});

afterEach(cleanup);

describe("CAL-01~05 SCN-CAL-1~3 일정 목록", () => {
  beforeEach(() => {
    navigation.search = "date=2026-10-16&view=day";
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
  it("로딩을 표시해요", () => {
    useEvents.mockReturnValue({ isPending: true, isError: false });
    render(<CalendarPage />);
    expect(
      screen.getByRole("group", { name: "하루 일정을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("빈 일 보기에는 시간대를 보여 주고 개인 일정 안내는 표시하지 않아요", () => {
    render(<CalendarPage />);
    expect(screen.getByText("08:00")).toBeVisible();
    expect(screen.queryByText(/은 시간만 보여요/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록" })).toBeVisible();
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
    expect(screen.getByText(/개인 일정/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /개인 일정/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "일정 수정" }),
    ).not.toBeInTheDocument();
  });
});

it("CAL-01 SCN-CAL-1 모바일 당기기는 기존 새 일정 시트를 열어요", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

  render(<CalendarPage />);
  const surface = document.querySelector('[data-od-id="calendar-main"]')!;
  fireEvent.touchStart(surface, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 40 }] });
  expect(screen.getByText("당겨서 일정 등록하기")).toBeVisible();
  const arrow = screen.getByText("당겨서 일정 등록하기").querySelector("svg")!;
  expect(arrow).toHaveAttribute("aria-hidden", "true");
  expect(arrow).not.toHaveClass("rotate-180");
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 90 }] });
  expect(screen.getByText("당겨서 일정 등록하기")).toBeVisible();
  expect(arrow).toHaveClass("rotate-180");
  fireEvent.touchEnd(surface, { touches: [] });

  expect(screen.getByRole("dialog", { name: "새 일정" })).toBeVisible();
  cleanup();
  vi.unstubAllGlobals();
});

describe("CAL-12 CAL-14 SCN-CAL-7 밀기와 홈 삭제", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    const event = {
      id,
      kind: "event",
      startDate: "2026-10-16",
      endDate: "2026-10-16",
      startTime: "15:00",
      endTime: "16:00",
      visibility: "shared",
      canEdit: true,
      details: {
        title: "삭제할 일정",
        categoryId: "category",
        place: "",
        memo: "",
      },
    };
    useEvent.mockReturnValue({ data: event });
    useEvents.mockReturnValue({ data: [event] });
    useEventCategories.mockReturnValue({ data: [] });
    deleteEvent.mockResolvedValue(null);
    navigation.search = "date=2026-10-16&view=month";
  });
  it.each(["error", "missing", "forbidden", "private"])(
    "CAL-12 삭제 진입 %s는 알림만 보여 주고 닫아요",
    (state) => {
      const event = useEvent().data;
      useEvent.mockReturnValue({
        isPending: false,
        isError: state === "error",
        error: new Error("조회 실패"),
        data:
          state === "missing"
            ? null
            : {
                ...event,
                canEdit: state !== "forbidden",
                details: state === "private" ? null : event.details,
              },
      });
      navigation.search += `&event=${id}&action=delete`;
      render(<CalendarPage />);
      expect(
        screen.getByText(
          state === "error"
            ? "조회 실패"
            : "일정을 찾을 수 없거나 삭제할 수 없어요.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-od-id="calendar-main"]'),
      ).not.toHaveTextContent(/삭제할 수 없어요/);
      expect(deleteEvent).not.toHaveBeenCalled();
    },
  );
  it("CAL-12 삭제 조회 중에는 본문에 스켈레톤을 끼워 넣지 않아요", () => {
    useEvent.mockReturnValue({ isPending: true });
    navigation.search += `&event=${id}&action=delete`;
    render(<CalendarPage />);
    expect(
      screen.queryByRole("group", { name: /불러오/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it.each(["swipe", "home"])(
    "%s 삭제 취소는 상세 시트를 남기지 않아요",
    async (entry) => {
      if (entry === "home") navigation.search += `&event=${id}&action=delete`;
      render(<CalendarPage />);
      if (entry === "swipe") {
        const button = screen.getByRole("button", {
          name: "삭제할 일정 삭제",
          hidden: true,
        });
        fireEvent.keyDown(button.closest("li")!, { key: "ArrowLeft" });
        fireEvent.click(button);
      }
      expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
        "‘삭제할 일정’ 일정을 삭제할까요?",
      );
      expect(screen.queryByText("상세 내용")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByText("상세 내용")).not.toBeInTheDocument();
      expect(deleteEvent).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "single", "following"] as const)(
    "상세 없이 삭제 범위 %s를 실행해요",
    async (scope) => {
      if (scope)
        useEvent.mockReturnValue({
          data: { ...useEvent().data, recurrence: "weekly" },
        });
      navigation.search += `&event=${id}~2026-10-16&action=delete`;
      render(<CalendarPage />);
      const label =
        scope === "single"
          ? "이 일정만"
          : scope === "following"
            ? "이후 모든 일정"
            : "삭제";
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: label,
        }),
      );
      await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith(id, scope));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByText("상세 내용")).not.toBeInTheDocument();
    },
  );
});
