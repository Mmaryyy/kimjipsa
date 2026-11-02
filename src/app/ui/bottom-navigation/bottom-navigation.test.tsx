import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BottomNavigation from ".";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
  });
  return event;
}

describe("P10.6 하단 메뉴 접근성과 렌즈 제스처", () => {
  beforeEach(() => {
    router.push.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 350,
      bottom: 56,
      width: 350,
      height: 56,
      x: 0,
      y: 0,
      toJSON() {},
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("nav와 다섯 링크의 키보드 순서, 현재 페이지를 유지하고 복사본은 숨겨요", () => {
    const { container } = render(<BottomNavigation pathname="/calendar" />);
    const links = within(
      screen.getByRole("navigation", { name: "하단 메뉴" }),
    ).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "오늘",
      "일정",
      "재고",
      "장바구니",
      "설정",
    ]);
    expect(screen.getByRole("link", { name: "일정" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    for (const link of links) {
      expect(link).not.toHaveAttribute("tabindex", "-1");
      link.focus();
      expect(link).toHaveFocus();
    }
    expect(container.querySelector("[data-copy]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector("[data-copy]")).toHaveAttribute("inert");
  });

  it("놓을 때 한 번만 가장 가까운 탭으로 이동하고 후속 클릭은 막아요", () => {
    render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    fireEvent(nav, pointer("pointerdown", 35, 25));
    fireEvent(window, pointer("pointermove", 190, 25));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent(window, pointer("pointerup", 190, 25));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/inventory");
    expect(
      fireEvent.click(screen.getByRole("link", { name: "재고" }), {
        detail: 1,
      }),
    ).toBe(false);
  });

  it.each(["vertical", "pointercancel", "Escape", "resize", "outside"])(
    "%s 취소는 화면을 바꾸지 않아요",
    (reason) => {
      render(<BottomNavigation pathname="/" />);
      const nav = screen.getByRole("navigation");
      fireEvent(nav, pointer("pointerdown", 35, 25));
      if (reason === "vertical")
        fireEvent(window, pointer("pointermove", 36, 40));
      if (reason === "pointercancel")
        fireEvent(nav, pointer("pointercancel", 35, 25));
      if (reason === "Escape") fireEvent.keyDown(window, { key: "Escape" });
      if (reason === "resize") fireEvent(window, new Event("resize"));
      fireEvent(
        window,
        pointer("pointerup", reason === "outside" ? 400 : 190, 25),
      );
      expect(router.push).not.toHaveBeenCalled();
    },
  );
});
