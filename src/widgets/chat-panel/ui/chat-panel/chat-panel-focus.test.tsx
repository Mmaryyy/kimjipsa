import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ChatNavigationProvider,
  useChatNavigation,
} from "@/features/chat-navigation";
import ChatPanel from ".";
import type { Chat } from "@/entities/chat-message";

const resizeObserver = globalThis.ResizeObserver;
const state = vi.hoisted(() => ({
  loading: false,
  pending: false,
  messages: [] as Chat["messages"],
  sendChoice: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/account", () => ({
  useBotCharacter: () => ({
    avatar: "/images/kimjipsa-avatar.png",
    label: "집사",
  }),
  useSaveBotType: () => ({ mutate: vi.fn(), isPending: false }),
  useAccount: () => ({
    data: { userId: "me", membership: { familyId: "home" } },
  }),
}));
vi.mock("@/entities/chat-message", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useChat: () => ({
    isPending: state.loading,
    data: state.loading
      ? undefined
      : {
          sessionVersion: 1,
          name: "집사",
          workerOnline: true,
          messages: state.messages,
          runs: [],
          receipts: [],
          proposals: [],
          attachments: [],
        },
    fetchNextPage: vi.fn(),
  }),
  useChatActions: () => ({ cancel: { mutate: vi.fn() } }),
}));
vi.mock("@/features/chat-send/model/use-chat-send", () => ({
  useChatSend: () => ({
    text: "메시지",
    photos: [],
    onText: vi.fn(),
    onRemove: vi.fn(),
    send: { isPending: state.pending, mutate: state.sendChoice },
    upload: { isPending: false },
  }),
}));
const Controls = () => {
  const { onOpen } = useChatNavigation();
  return (
    <>
      <button onClick={onOpen}>대화 열기</button>
      <ChatPanel />
    </>
  );
};
const mount = () =>
  render(
    <ChatNavigationProvider>
      <Controls />
    </ChatNavigationProvider>,
  );
const openPanel = () => {
  const opener = screen.getByRole("button", { name: "대화 열기" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};
beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("ResizeObserver", resizeObserver);
  localStorage.clear();
  state.loading = false;
  state.pending = false;
  state.messages = [];
  state.sendChoice.mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("BOT-01 데스크톱은 입력창에 포커스하고 닫으면 연 버튼으로 돌아가요", async () => {
  mount();
  const opener = openPanel();
  expect(
    screen.getByRole("textbox", { name: "집사에게 보낼 메시지" }),
  ).toHaveFocus();
  expect(screen.getByRole("button", { name: "최소화" })).not.toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  await waitFor(() => expect(opener).toHaveFocus());
});
it("BOT-01 터치 기기는 키보드 대신 대화 목록에 포커스해요", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: coarse)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  mount();
  openPanel();
  expect(screen.getByLabelText("대화 내역")).toHaveFocus();
  expect(screen.getByLabelText("대화 내역")).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("textbox")).not.toHaveFocus();
});
it("BOT-01 첫 조회 뒤 입력창에 포커스하되 사용자가 옮긴 포커스는 유지해요", () => {
  state.loading = true;
  const view = mount();
  openPanel();
  expect(screen.getByLabelText("대화 내역")).toHaveFocus();
  state.loading = false;
  view.rerender(
    <ChatNavigationProvider>
      <Controls />
    </ChatNavigationProvider>,
  );
  expect(screen.getByRole("textbox")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  state.loading = true;
  openPanel();
  const minimize = screen.getByRole("button", { name: "최소화" });
  minimize.focus();
  state.loading = false;
  view.rerender(
    <ChatNavigationProvider>
      <Controls />
    </ChatNavigationProvider>,
  );
  expect(minimize).toHaveFocus();
});

const question = (id: string, sequence: number): Chat["messages"][number] => ({
  id,
  sequence,
  role: "assistant",
  text: "공개 범위를 골라 주세요.",
  author: "김집사",
  created_at: "2026-11-04T03:00:00Z",
  visibility: "private",
  attachment_ids: [],
  sources: [],
  choices: [
    { label: "공유 일정", value: "shared" },
    { label: "개인 일정", value: "private" },
  ],
});
it("BOT-07 최신 질문의 선택 라벨만 기존 전송 경로로 보내요", () => {
  state.messages = [question("old", 1), question("latest", 2)];
  mount();
  openPanel();
  const buttons = screen.getAllByRole("button", { name: "개인 일정" });
  expect(buttons[0]).toBeDisabled();
  expect(buttons[1]).toBeEnabled();
  fireEvent.click(buttons[0]);
  expect(state.sendChoice).not.toHaveBeenCalled();
  fireEvent.click(buttons[1]);
  expect(state.sendChoice).toHaveBeenCalledExactlyOnceWith("개인 일정");
});
it("BOT-07 재조회한 답장에서 선택 표시를 복원하고 이전 질문을 비활성화해요", () => {
  state.messages = [
    question("question", 1),
    {
      ...question("answer", 2),
      role: "user",
      author: "나",
      text: "공유 일정",
      choices: [],
    },
  ];
  mount();
  openPanel();
  expect(screen.getByRole("group", { name: "답 고르기" })).toBeVisible();
  expect(screen.getByRole("button", { name: "공유 일정" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "공유 일정" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "개인 일정" })).toBeDisabled();
});

it("BOT-07 입력창 전송 중에는 선택지도 비활성화해요", () => {
  state.messages = [question("latest", 1)];
  const view = mount();
  openPanel();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "내일" } });
  fireEvent.submit(
    screen.getByRole("form", { name: "집사에게 메시지 보내기" }),
  );
  expect(state.sendChoice).toHaveBeenCalled();
  state.pending = true;
  view.rerender(
    <ChatNavigationProvider>
      <Controls />
    </ChatNavigationProvider>,
  );
  expect(screen.getByRole("button", { name: "공유 일정" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "개인 일정" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "보내는 중" })).toBeDisabled();
});
