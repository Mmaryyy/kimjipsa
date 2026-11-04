import {
  act,
  fireEvent,
  render,
  screen,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/shared/ui";
import { ChatNavigationProvider, useChatNavigation } from "./chat-navigation";

const router = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/" }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => router.pathname,
}));
const Controls = () => {
  const { ready, open, minimized, onOpen, onMinimize, onClose } =
    useChatNavigation();
  return (
    <>
      {ready && <span>{minimized ? "메뉴 집사" : "집 버튼"}</span>}
      <span>{open ? "대화 열림" : "대화 닫힘"}</span>
      <button onClick={onOpen}>열기</button>
      <button onClick={onMinimize}>최소화</button>
      <button onClick={onClose}>닫기</button>
    </>
  );
};
const mount = () =>
  render(
    <ToastProvider>
      <ChatNavigationProvider>
        <Controls />
      </ChatNavigationProvider>
    </ToastProvider>,
  );
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
  router.pathname = "/";
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("BOT-01 최소화는 저장하고 시트만 닫으며 되돌리기는 집 버튼을 복원해요", () => {
  mount();
  fireEvent.click(screen.getByText("열기"));
  expect(screen.getByText("대화 열림")).toBeVisible();
  fireEvent.click(screen.getByText("최소화"));
  expect(screen.getByText("대화 닫힘")).toBeVisible();
  expect(screen.getByText("메뉴 집사")).toBeVisible();
  expect(localStorage.getItem("kj:botMin")).toBe("1");
  fireEvent.click(screen.getByText("되돌리기"));
  expect(screen.getByText("집 버튼")).toBeVisible();
  expect(localStorage.getItem("kj:botMin")).toBe("0");
});
it("BOT-01 저장된 최소화를 읽고 외부 이력이 있어도 닫기는 앱을 떠나지 않아요", () => {
  localStorage.setItem("kj:botMin", "1");
  const back = vi.spyOn(window.history, "back");
  mount();
  expect(screen.getByText("메뉴 집사")).toBeVisible();
  fireEvent.click(screen.getByText("열기"));
  fireEvent.click(screen.getByText("닫기"));
  expect(back).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
it("BOT-01 모바일은 이력을 하나 추가하고 뒤로가기로 시트만 닫아요", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const push = vi.spyOn(window.history, "pushState");
  mount();
  fireEvent.click(screen.getByText("열기"));
  fireEvent.click(screen.getByText("열기"));
  expect(push).toHaveBeenCalledOnce();
  act(() => {
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByText("대화 닫힘")).toBeVisible();
  expect(window.location.pathname).toBe("/");
});
it("BOT-01 모바일 닫기 버튼은 시트가 넣은 이력만 정리해요", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  mount();
  fireEvent.click(screen.getByText("열기"));
  fireEvent.click(screen.getByText("닫기"));
  expect(back).toHaveBeenCalledOnce();
  expect(screen.getByText("대화 닫힘")).toBeVisible();
});
it("BOT-01 /chat 링크는 홈으로 replace한 뒤 시트를 열어요", () => {
  router.pathname = "/chat";
  const view = mount();
  expect(router.replace).toHaveBeenCalledWith("/");
  router.pathname = "/";
  view.rerender(
    <ToastProvider>
      <ChatNavigationProvider>
        <Controls />
      </ChatNavigationProvider>
    </ToastProvider>,
  );
  expect(screen.getByText("대화 열림")).toBeVisible();
});
it("BOT-01 저장소가 막혀도 최소화해요", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  mount();
  fireEvent.click(screen.getByText("최소화"));
  expect(screen.getByText("메뉴 집사")).toBeVisible();
});

it.each([
  ["/login", "/"],
  ["/", "/login", "/"],
])(
  "BOT-01 /chat 인증 이동 %j 뒤 홈에서 시트를 다시 열지 않아요",
  (...paths) => {
    router.pathname = "/chat";
    const view = mount();
    for (const pathname of paths) {
      router.pathname = pathname;
      view.rerender(
        <ToastProvider>
          <ChatNavigationProvider>
            <Controls />
          </ChatNavigationProvider>
        </ToastProvider>,
      );
    }
    expect(screen.getByText("대화 닫힘")).toBeVisible();
  },
);
