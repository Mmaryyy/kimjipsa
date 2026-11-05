import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useNavigationScroll } from "./use-navigation-scroll";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.navigationScrollLocked;
  delete document.documentElement.dataset.navigationScrollRestoreUntil;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([false, true])(
  "BOT-01 스크롤 방향과 가장자리·동작 줄이기(%s)를 따라요",
  (reduced) => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
      2000,
    );
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("scrollY", 0);
    const { result } = renderHook(() => useNavigationScroll());
    const scroll = (y: number) => {
      vi.stubGlobal("scrollY", y);
      fireEvent.scroll(window);
    };
    scroll(4);
    expect(result.current.collapsed).toBe(false);
    scroll(12);
    expect(result.current.collapsed).toBe(!reduced);
    scroll(3);
    expect(result.current.collapsed).toBe(false);
    scroll(100);
    expect(result.current.collapsed).toBe(!reduced);
    scroll(1200);
    expect(result.current.collapsed).toBe(false);
    scroll(1100);
    scroll(1110);
    expect(result.current.collapsed).toBe(!reduced);
    scroll(0);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.scrolling).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.scrolling).toBe(false);
  },
);

it("BOT-01 입력 중 키보드가 열리고 닫히는 것을 두 탐색 요소에 알려요", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 400 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 800);
  const input = document.createElement("input");
  document.body.append(input);
  const { result } = renderHook(() => useNavigationScroll());
  act(() => input.focus());
  expect(result.current.keyboardOpen).toBe(true);
  Object.assign(viewport, { height: 800 });
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(result.current.keyboardOpen).toBe(false);
  input.remove();
});

it("BOT-01 채팅 문서 잠금과 복원 스크롤은 탐색 버튼을 접거나 숨기지 않아요", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("scrollY", 360);
  vi.stubGlobal("innerHeight", 800);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
    2000,
  );
  const { result } = renderHook(() => useNavigationScroll());
  const root = document.documentElement;
  root.dataset.navigationScrollLocked = "true";
  vi.stubGlobal("scrollY", 0);
  fireEvent.scroll(window);
  delete root.dataset.navigationScrollLocked;
  root.dataset.navigationScrollRestoreUntil = String(performance.now() + 100);
  vi.stubGlobal("scrollY", 360);
  fireEvent.scroll(window);
  expect(result.current.collapsed).toBe(false);
  expect(result.current.scrolling).toBe(false);
  delete root.dataset.navigationScrollRestoreUntil;
  vi.stubGlobal("scrollY", 361);
  fireEvent.scroll(window);
  expect(result.current.collapsed).toBe(false);
  vi.stubGlobal("scrollY", 380);
  fireEvent.scroll(window);
  expect(result.current.collapsed).toBe(true);
});
