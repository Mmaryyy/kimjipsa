import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ChatNavigationProvider,
  useChatNavigation,
} from "@/features/chat-navigation";
import ChatPanel from ".";

const resizeObserver = globalThis.ResizeObserver;
const state = vi.hoisted(() => ({ loading: false }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/account", () => ({
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
          messages: [],
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
    text: "",
    photos: [],
    onText: vi.fn(),
    onRemove: vi.fn(),
    send: { isPending: false },
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
  vi.stubGlobal("ResizeObserver", resizeObserver);
  localStorage.clear();
  state.loading = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

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
