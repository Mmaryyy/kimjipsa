import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfettiBurst } from "./use-confetti-burst";

const { burst, reset, create } = vi.hoisted(() => {
  const reset = vi.fn();
  const burst = Object.assign(vi.fn(), { reset });
  return { burst, reset, create: vi.fn(() => burst) };
});
vi.mock("canvas-confetti", () => ({ default: { create } }));

function Banner({ visible = true }: { visible?: boolean }) {
  const ref = useConfettiBurst(visible);
  return <article ref={ref}>축하 카드</article>;
}

async function showBanner(visible = true) {
  const result = render(<Banner visible={visible} />);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  return result;
}

describe("CAL-16 SCN-CAL-10 축하 카드 색종이", () => {
  let motion: EventTarget & { matches: boolean };
  let intersect: (visible: boolean) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    motion = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => motion),
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = (visible) =>
            callback(
              [{ isIntersecting: visible } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
        }
        observe() {
          intersect(true);
        }
        disconnect() {}
      },
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.documentElement.style.setProperty("--sys-pink", "test-pink");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--sys-pink");
  });

  it("카드가 보이면 바로 터뜨리고 8초마다 같은 캔버스에서 반복해요", async () => {
    await showBanner();
    expect(create).toHaveBeenCalledOnce();
    expect(burst).toHaveBeenCalledOnce();
    expect(burst).toHaveBeenCalledWith(
      expect.objectContaining({
        colors: ["test-pink"],
        disableForReducedMotion: true,
      }),
    );
    expect(document.querySelector("canvas")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(document.querySelector("article > canvas")).not.toBeNull();
    expect(document.querySelector("canvas")).toHaveClass("absolute");
    expect(burst).toHaveBeenCalledWith(
      expect.objectContaining({ origin: { x: 0.5, y: 0 } }),
    );
    act(() => vi.advanceTimersByTime(16000));
    expect(burst).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledOnce();
  });

  it("닫으면 즉시 멈추고 캔버스와 타이머를 정리해요", async () => {
    const { rerender } = await showBanner();
    rerender(<Banner visible={false} />);
    expect(reset).toHaveBeenCalled();
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(16000));
    expect(burst).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("카드가 사라져도 진행 중 애니메이션을 정리해요", async () => {
    const { unmount } = await showBanner();
    unmount();
    expect(reset).toHaveBeenCalled();
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("동작 줄이기를 켜면 카드만 보여 주고 색종이는 불러오지 않아요", async () => {
    motion.matches = true;
    await showBanner();
    expect(create).not.toHaveBeenCalled();
    expect(burst).not.toHaveBeenCalled();
  });

  it("도중에 동작 줄이기를 켜도 즉시 멈춰요", async () => {
    await showBanner();
    act(() => {
      motion.matches = true;
      motion.dispatchEvent(new Event("change"));
      vi.advanceTimersByTime(16000);
    });
    expect(reset).toHaveBeenCalled();
    expect(burst).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("숨겨진 탭에서는 터뜨리지 않고 다시 보일 때 시작해요", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    await showBanner();
    expect(create).not.toHaveBeenCalled();
    await act(async () => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.dynamicImportSettled();
    });
    expect(burst).toHaveBeenCalledOnce();
    act(() => {
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(16000);
    });
    expect(reset).toHaveBeenCalled();
    expect(burst).toHaveBeenCalledOnce();
  });

  it("스크롤로 카드가 화면 밖으로 나가면 멈춰요", async () => {
    await showBanner();
    act(() => {
      intersect(false);
      vi.advanceTimersByTime(16000);
    });
    expect(reset).toHaveBeenCalled();
    expect(burst).toHaveBeenCalledOnce();
  });
});
