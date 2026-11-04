import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BottomNavigation from ".";
import { renderToString } from "react-dom/server";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function pointer(type: string, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: pointerType },
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
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(350);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  it("90%로 축소된 바에서도 레일 좌표로 끌어 탭을 선택해요", () => {
    render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    vi.mocked(nav.getBoundingClientRect).mockReturnValue({
      left: 17.5,
      top: 0,
      right: 332.5,
      bottom: 50.4,
      width: 315,
      height: 50.4,
      x: 17.5,
      y: 0,
      toJSON() {},
    });
    fireEvent(
      screen.getByRole("link", { name: "오늘" }),
      pointer("pointerdown", 49, 25),
    );
    fireEvent(nav, pointer("pointermove", 188.5, 25));
    fireEvent(nav, pointer("pointerup", 188.5, 25));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/inventory");
  });

  it("놓을 때 한 번만 가장 가까운 탭으로 이동하고 후속 클릭은 막아요", () => {
    render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    fireEvent(
      screen.getByRole("link", { name: "오늘" }),
      pointer("pointerdown", 35, 25),
    );
    fireEvent(nav, pointer("pointermove", 190, 25));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent(nav, pointer("pointerup", 190, 25));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/inventory");
    fireEvent(nav, pointer("lostpointercapture", 190, 25));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(nav.querySelectorAll("[data-selection]")).toHaveLength(1);
    expect(nav.querySelector("[data-lens] [data-copy]")).not.toBeNull();
    expect(
      fireEvent.click(screen.getByRole("link", { name: "재고" }), {
        detail: 1,
      }),
    ).toBe(false);
  });

  it.each(["link", "nav"])(
    "터치 끌기 중 %s의 캡처 해제는 대상에 따라 무시하거나 취소해요",
    (target) => {
      render(<BottomNavigation pathname="/" />);
      const nav = screen.getByRole("navigation");
      const link = screen.getByRole("link", { name: "오늘" });
      vi.mocked(nav.setPointerCapture).mockImplementation(() => {
        fireEvent(link, pointer("lostpointercapture", 190, 25, "touch"));
      });
      fireEvent(link, pointer("pointerdown", 35, 25, "touch"));
      fireEvent(link, pointer("pointermove", 190, 25, "touch"));
      expect(nav.setPointerCapture).toHaveBeenCalledWith(1);
      if (target === "nav") {
        fireEvent(nav, pointer("lostpointercapture", 190, 25, "touch"));
      }
      fireEvent(nav, pointer("pointerup", 190, 25, "touch"));
      if (target === "link") {
        expect(router.push).toHaveBeenCalledExactlyOnceWith("/inventory");
      } else {
        expect(router.push).not.toHaveBeenCalled();
      }
    },
  );

  it("경로 반영 전 캡처가 해제돼도 놓은 탭을 향해 계속 움직여요", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    fireEvent(
      screen.getByRole("link", { name: "오늘" }),
      pointer("pointerdown", 35, 25),
    );
    fireEvent(nav, pointer("pointermove", 190, 25));
    fireEvent(nav, pointer("pointerup", 190, 25));
    fireEvent(nav, pointer("lostpointercapture", 190, 25));
    let time = 0;
    while (frames.length && time < 3000) frames.shift()!((time += 16));
    expect(nav.style.getPropertyValue("--indicator-x")).toBe("140px");
    expect(nav.style.getPropertyValue("--indicator-sx")).toBe("1");
    expect(nav.style.getPropertyValue("--lens-lift")).toBe("0");
    expect(nav).not.toHaveAttribute("data-lens-visible");
    expect(nav).not.toHaveAttribute("data-animating");
  });

  it.each([
    null,
    "(prefers-reduced-motion: reduce)",
    "(forced-colors: active)",
  ])(
    "렌즈가 원본 셀 위치를 유지하고 동작 감소·강제 색상 %s를 따라요",
    (preference) => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === preference,
        addEventListener() {},
        removeEventListener() {},
      }));
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      render(<BottomNavigation pathname="/" />);
      const nav = screen.getByRole("navigation");
      const faces = Array.from(
        nav.querySelectorAll<HTMLElement>("[data-original-face]"),
      );
      const positions = faces.map((face) => face.style.cssText);
      fireEvent(
        screen.getByRole("link", { name: "오늘" }),
        pointer("pointerdown", 35, 25),
      );
      for (let time = 16; frames.length && time <= 800; time += 16) {
        frames.shift()!(time);
      }
      expect(Number(nav.style.getPropertyValue("--lens-lift"))).toBe(
        preference ? 0 : 1,
      );
      expect(nav.hasAttribute("data-lens-visible")).toBe(!preference);
      expect(screen.getByRole("link", { name: "오늘" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(faces.map((face) => face.style.cssText)).toEqual(positions);
      expect(faces).toHaveLength(5);
      expect(nav.style.getPropertyValue("--lens-width") !== "").toBe(
        !preference,
      );
    },
  );

  it("하이드레이션 전에도 현재 탭의 선택 면 폭과 위치를 제공해요", () => {
    const html = renderToString(<BottomNavigation pathname="/inventory" />);
    expect(html).toContain("--tab-cell:calc((100% - 8px) / 5)");
    expect(html).toContain("--indicator-default-x:200%");
    expect(html).toContain("--selection-visible:1");
  });

  it("끌지 않고 탭하면 한 번 이동하고 바로 뒤의 포인터 클릭만 막아요", () => {
    render(<BottomNavigation pathname="/" />);
    const link = screen.getByRole("link", { name: "일정" });
    fireEvent(link, pointer("pointerdown", 105, 25));
    fireEvent(link, pointer("pointerup", 105, 25));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/calendar");
    expect(fireEvent.click(link, { detail: 1 })).toBe(false);
    expect(fireEvent.click(link, { detail: 0 })).toBe(true);
  });

  it("취소 후 Enter와 보조기기 클릭을 막지 않아요", async () => {
    vi.useFakeTimers();
    render(<BottomNavigation pathname="/" />);
    const link = screen.getByRole("link", { name: "일정" });
    fireEvent(link, pointer("pointerdown", 105, 25));
    fireEvent(link, pointer("pointercancel", 105, 25));
    fireEvent.keyDown(link, { key: "Enter" });
    expect(fireEvent.click(link, { detail: 0 })).toBe(true);
    fireEvent(link, pointer("pointerdown", 105, 25));
    fireEvent(link, pointer("pointercancel", 105, 25));
    await vi.advanceTimersByTimeAsync(501);
    expect(fireEvent.click(link, { detail: 1 })).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(["tap", "cancel"])(
    "%s 뒤 늦게 오는 터치 클릭 한 번을 막아요",
    async (gesture) => {
      vi.useFakeTimers();
      render(<BottomNavigation pathname="/" />);
      const link = screen.getByRole("link", { name: "일정" });
      fireEvent(link, pointer("pointerdown", 105, 25, "touch"));
      fireEvent(
        link,
        pointer(
          gesture === "tap" ? "pointerup" : "pointercancel",
          105,
          25,
          "touch",
        ),
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(fireEvent.click(link, { detail: 0 })).toBe(true);
      expect(fireEvent.click(link, { detail: 1, ctrlKey: true })).toBe(true);
      expect(fireEvent.click(link, { detail: 1 })).toBe(false);
      expect(fireEvent.click(link, { detail: 1 })).toBe(true);
      expect(router.push).toHaveBeenCalledTimes(gesture === "tap" ? 1 : 0);
    },
  );

  it.each(["/calendar", "/terms"])(
    "현재 탭을 다시 누른 뒤 %s 경로를 반영해요",
    async (pathname) => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }));
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      const { rerender } = render(<BottomNavigation pathname="/" />);
      const link = screen.getByRole("link", { name: "오늘" });
      fireEvent(link, pointer("pointerdown", 35, 25));
      fireEvent(link, pointer("pointerup", 35, 25));
      await act(async () => rerender(<BottomNavigation pathname={pathname} />));
      let time = 0;
      while (frames.length && time < 3000) frames.shift()!((time += 16));
      const nav = screen.getByRole("navigation");
      expect(nav.style.getPropertyValue("--indicator-x")).toBe(
        pathname === "/calendar" ? "70px" : "0px",
      );
      expect(nav.style.getPropertyValue("--selection-visible")).toBe(
        pathname === "/calendar" ? "1" : "0",
      );
    },
  );

  it.each(["/", "/terms"])(
    "이동 실패나 리디렉트 뒤 %s의 선택을 복구해요",
    async (pathname) => {
      vi.useFakeTimers();
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }));
      const { rerender } = render(<BottomNavigation pathname="/" />);
      const link = screen.getByRole("link", { name: "일정" });
      fireEvent(link, pointer("pointerdown", 105, 25));
      fireEvent(link, pointer("pointerup", 105, 25));
      await act(async () => rerender(<BottomNavigation pathname={pathname} />));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      const nav = screen.getByRole("navigation");
      expect(nav.style.getPropertyValue("--indicator-x")).toBe("0px");
      expect(nav.style.getPropertyValue("--selection-visible")).toBe(
        pathname === "/" ? "1" : "0",
      );
    },
  );

  it("r188-f1 이동이 1초 넘게 걸려도 선택이 돌아가지 않고 경로 반영 시 타이머를 해제해요", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const { rerender } = render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    const link = screen.getByRole("link", { name: "일정" });
    fireEvent(link, pointer("pointerdown", 105, 25));
    fireEvent(link, pointer("pointerup", 105, 25));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByRole("link", { name: "오늘" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav.style.getPropertyValue("--indicator-x")).toBe("70px");
    await act(async () => rerender(<BottomNavigation pathname="/calendar" />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(nav.style.getPropertyValue("--indicator-x")).toBe("70px");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey", "middle"])(
    "%s 클릭은 링크 기본 동작에 맡겨요",
    (modifier) => {
      render(<BottomNavigation pathname="/" />);
      const link = screen.getByRole("link", { name: "일정" });
      const event = pointer("pointerdown", 105, 25);
      Object.defineProperty(
        event,
        modifier === "middle" ? "button" : modifier,
        {
          value: modifier === "middle" ? 1 : true,
        },
      );
      fireEvent(link, event);
      fireEvent(link, pointer("pointerup", 105, 25));
      expect(router.push).not.toHaveBeenCalled();
      expect(fireEvent.click(link, { detail: 1, [modifier]: true })).toBe(true);
    },
  );

  it("연속 탭의 마지막 경로가 반영될 때까지 이전 경로로 돌아가지 않아요", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const { rerender } = render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    for (const [name, x] of [
      ["일정", 105],
      ["재고", 175],
    ] as const) {
      const link = screen.getByRole("link", { name });
      fireEvent(link, pointer("pointerdown", x, 25));
      fireEvent(link, pointer("pointerup", x, 25));
    }
    await act(async () => rerender(<BottomNavigation pathname="/calendar" />));
    let time = 0;
    while (frames.length && time < 3000) frames.shift()!((time += 16));
    expect(nav.style.getPropertyValue("--indicator-x")).toBe("140px");
    await act(async () => rerender(<BottomNavigation pathname="/inventory" />));
    while (frames.length && time < 6000) frames.shift()!((time += 16));
    expect(nav.style.getPropertyValue("--indicator-x")).toBe("140px");
  });

  it("언마운트하면 전역 리스너와 프레임·측정 높이를 제거해요", () => {
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    const removeNav = vi.spyOn(nav, "removeEventListener");
    fireEvent(
      screen.getByRole("link", { name: "일정" }),
      pointer("pointerdown", 105, 25),
    );
    unmount();
    expect(
      document.documentElement.style.getPropertyValue(
        "--bottom-navigation-measured-height",
      ),
    ).toBe("");
    for (const name of ["keydown", "resize", "blur"]) {
      expect(removeWindow).toHaveBeenCalledWith(name, expect.any(Function));
    }
    expect(removeDocument).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeNav).toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(cancelFrame).toHaveBeenCalled();
  });

  it.each([
    "vertical",
    "pointercancel",
    "Escape",
    "resize",
    "outside",
    "blur",
    "hidden",
  ])("%s 취소는 화면을 바꾸지 않아요", (reason) => {
    render(<BottomNavigation pathname="/" />);
    const nav = screen.getByRole("navigation");
    fireEvent(
      screen.getByRole("link", { name: "오늘" }),
      pointer("pointerdown", 35, 25),
    );
    if (reason === "vertical") fireEvent(nav, pointer("pointermove", 36, 40));
    if (reason === "pointercancel")
      fireEvent(nav, pointer("pointercancel", 35, 25));
    if (reason === "Escape") fireEvent.keyDown(window, { key: "Escape" });
    if (reason === "blur") fireEvent(window, new Event("blur"));
    if (reason === "hidden") {
      vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      fireEvent(document, new Event("visibilitychange"));
    }
    if (reason === "resize") fireEvent(window, new Event("resize"));
    fireEvent(nav, pointer("pointerup", reason === "outside" ? 400 : 190, 25));
    expect(router.push).not.toHaveBeenCalled();
  });
});
