import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ChatLauncher from ".";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it.each([false, true])(
  "BOT-01 집 버튼의 안내는 동작 줄이기(%s)를 따라요",
  (reduced) => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    const { unmount } = render(<ChatLauncher />);
    const launcher = screen.getByRole("button", {
      name: "AI 집사 채팅 열기",
    });
    const peek = launcher.querySelector('[aria-hidden="true"]');
    act(() => vi.advanceTimersByTime(6000));
    expect(peek).toHaveAttribute("data-visible", String(!reduced));
    act(() => vi.advanceTimersByTime(4000));
    expect(peek).toHaveAttribute("data-visible", "false");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("BOT-01 스크롤 중에는 집 버튼과 안내를 숨기고 마지막 이벤트 500ms 뒤 복귀해요", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const { unmount } = render(<ChatLauncher />);
  const launcher = screen.getByRole("button", {
    name: "AI 집사 채팅 열기",
  });
  const peek = launcher.querySelector('[aria-hidden="true"]');
  act(() => vi.advanceTimersByTime(6000));
  expect(peek).toHaveAttribute("data-visible", "true");

  fireEvent.scroll(window);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(launcher).toHaveAttribute("tabindex", "-1");
  expect(launcher.parentElement).toHaveAttribute("inert");
  expect(peek).toHaveAttribute("data-visible", "false");
  act(() => vi.advanceTimersByTime(400));
  fireEvent.scroll(window);
  act(() => vi.advanceTimersByTime(499));
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("button")).toBe(launcher);
  expect(launcher).not.toHaveAttribute("tabindex");
  expect(launcher.parentElement).not.toHaveAttribute("inert");

  fireEvent.scroll(window);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.scroll(window);
  expect(vi.getTimerCount()).toBe(0);
});

it("BOT-01 집 버튼에 키보드 포커스가 있으면 스크롤해도 유지해요", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const { unmount } = render(<ChatLauncher />);
  const launcher = screen.getByRole("button", {
    name: "AI 집사 채팅 열기",
  });
  act(() => launcher.focus());
  fireEvent.scroll(window);
  expect(screen.getByRole("button")).toBe(launcher);
  expect(launcher).toHaveFocus();
  act(() => launcher.blur());
  fireEvent.scroll(window);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  unmount();
});
