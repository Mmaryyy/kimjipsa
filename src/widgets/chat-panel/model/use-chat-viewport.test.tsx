import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatViewport } from "./use-chat-viewport";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});

afterEach(() => {
  delete document.documentElement.dataset.navigationScrollLocked;
  delete document.documentElement.dataset.navigationScrollRestoreUntil;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("BOT-01 키보드와 창 스크롤이 반복되어도 위치가 누적되지 않고 닫으면 복원해요", () => {
  const root = document.documentElement;
  const body = document.body;
  const originalRootStyle = root.style.cssText;
  const originalBodyStyle = body.style.cssText;
  const viewport = Object.assign(new EventTarget(), {
    height: 812,
    offsetTop: 0,
  });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("scrollX", 0);
  vi.stubGlobal("scrollY", 360);
  const scrollTo = vi
    .spyOn(window, "scrollTo")
    .mockImplementation((options: number | ScrollToOptions) => {
      if (typeof options === "object") {
        vi.stubGlobal("scrollX", options.left ?? 0);
        vi.stubGlobal("scrollY", options.top ?? 0);
      }
    });
  const contentRef = createRef<HTMLDivElement>();
  const input = document.createElement("textarea");
  body.append(input);
  const { unmount } = renderHook(() => useChatViewport(contentRef));
  expect(root.style.overflow).toBe("hidden");
  expect(body.style.overflow).toBe("hidden");
  expect(body.style.position).toBe("fixed");
  expect(body.style.top).toBe("-360px");

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    act(() => {
      input.focus();
      vi.stubGlobal("scrollY", cycle * 80);
      Object.assign(viewport, { height: 420, offsetTop: 35 });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(window.scrollY).toBe(0);
    expect(root.style.getPropertyValue("--chat-viewport-top")).toBe("35px");
    expect(root.style.getPropertyValue("--chat-viewport-height")).toBe("420px");
    act(() => {
      input.blur();
      vi.stubGlobal("scrollY", cycle * 80);
      Object.assign(viewport, { height: 812, offsetTop: 0 });
      fireEvent.scroll(window);
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(window.scrollY).toBe(0);
    expect(root.style.getPropertyValue("--chat-viewport-top")).toBe("0px");
    expect(root.style.getPropertyValue("--chat-viewport-height")).toBe("812px");
    expect(body.style.top).toBe("-360px");
  }

  unmount();
  input.remove();
  expect(scrollTo).toHaveBeenLastCalledWith({
    left: 0,
    top: 360,
    behavior: "instant",
  });
  expect(root.style.cssText).toBe(originalRootStyle);
  expect(body.style.cssText).toBe(originalBodyStyle);
  expect(window.scrollY).toBe(360);
  // 닫힌 뒤에는 남은 뷰포트 이벤트가 스타일이나 스크롤을 바꾸지 않아요.
  viewport.dispatchEvent(new Event("resize"));
  fireEvent.scroll(window);
  expect(window.scrollY).toBe(360);
  expect(root.style.cssText).toBe(originalRootStyle);
});

it("BOT-01 시트 바깥 touchmove만 차단하고 닫으면 차단을 해제해요", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  const content = document.createElement("div");
  panel.append(content);
  document.body.append(panel);
  const contentRef = createRef<HTMLDivElement>();
  contentRef.current = content;
  const { unmount } = renderHook(() => useChatViewport(contentRef));
  expect(fireEvent.touchMove(document.body)).toBe(false);
  expect(fireEvent.touchMove(content)).toBe(true);
  unmount();
  expect(fireEvent.touchMove(document.body)).toBe(true);
  panel.remove();
});

it("BOT-01 visualViewport가 없으면 창 높이를 쓰고 기존 인라인 스타일을 복원해요", () => {
  vi.stubGlobal("visualViewport", undefined);
  vi.stubGlobal("innerHeight", 700);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = "clip";
  body.style.position = "relative";
  const contentRef = createRef<HTMLDivElement>();
  const { unmount } = renderHook(() => useChatViewport(contentRef));
  expect(root.style.getPropertyValue("--chat-viewport-height")).toBe("700px");
  vi.stubGlobal("innerHeight", 500);
  fireEvent.resize(window);
  expect(root.style.getPropertyValue("--chat-viewport-height")).toBe("500px");
  unmount();
  expect(root.style.overflow).toBe("clip");
  expect(body.style.position).toBe("relative");
  root.style.overflow = "";
  body.style.position = "";
});

it("BOT-01 데스크톱에서는 문서 위치와 바깥 터치를 바꾸지 않아요", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("scrollY", 360);
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const original = document.body.style.cssText;
  const { unmount } = renderHook(() => useChatViewport(createRef()));
  expect(document.body.style.cssText).toBe(original);
  expect(fireEvent.touchMove(document.body)).toBe(true);
  fireEvent.scroll(window);
  unmount();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(document.body.style.cssText).toBe(original);
});
