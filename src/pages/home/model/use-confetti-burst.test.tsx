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
    vi.spyOn(Math, "random").mockReturnValue(0.5);
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
    expect(burst).toHaveBeenCalledTimes(10);
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
      expect.objectContaining({ origin: { x: 1.15, y: 1.5 } }),
    );
    act(() => vi.advanceTimersByTime(16000));
    expect(burst).toHaveBeenCalledTimes(30);
    expect(create).toHaveBeenCalledOnce();
  });

  it.each([358, 600, 952])(
    "너비 %s에서도 좌우 두 지점에서 Realistic Look 다섯 겹으로 쏴요",
    async (width) => {
      vi.spyOn(
        HTMLCanvasElement.prototype,
        "getBoundingClientRect",
      ).mockReturnValue(new DOMRect(0, 0, width, 106));
      await showBanner();
      expect(burst).toHaveBeenCalledTimes(10);
      const upwardAngle = (Math.atan2(159, width * 0.65) * 180) / Math.PI;
      const baseSpread = Math.min(100, upwardAngle * 3);
      const baseVelocity = Math.hypot(width * 0.65, 159) * 0.045;
      const expectedLayers = [
        {
          ratio: 0.25,
          spread: 0.26,
          velocity: 55 / 45,
          decay: 0.975,
          scalar: 1,
        },
        { ratio: 0.2, spread: 0.6, velocity: 1, decay: 0.975, scalar: 1 },
        { ratio: 0.35, spread: 1, velocity: 1, decay: 0.91, scalar: 0.8 },
        {
          ratio: 0.1,
          spread: 1.2,
          velocity: 25 / 45,
          decay: 0.92,
          scalar: 1.2,
        },
        { ratio: 0.1, spread: 1.2, velocity: 1, decay: 0.975, scalar: 1 },
      ];
      const counts = width > 600 ? [65, 65] : [45, 45];
      counts.forEach((count, point) => {
        let cumulativeRatio = 0;
        let emittedCount = 0;
        expectedLayers.forEach((layer, index) => {
          cumulativeRatio += layer.ratio;
          const cumulativeCount = Math.round(count * cumulativeRatio);
          const options = burst.mock.calls[point * 5 + index][0];
          expect(options).toEqual(
            expect.objectContaining({
              origin: { x: point === 0 ? 1.15 : -0.15, y: 1.5 },
              angle: expect.closeTo(
                point === 0 ? 180 - upwardAngle : upwardAngle,
              ),
              startVelocity: expect.closeTo(baseVelocity * layer.velocity),
              spread: expect.closeTo(
                Math.min(upwardAngle * 2, baseSpread * layer.spread),
              ),
              decay: layer.decay,
              gravity: 0.1,
              ticks: 150,
              particleCount: cumulativeCount - emittedCount,
            }),
          );
          expect(options.scalar ?? 1).toBe(layer.scalar);
          emittedCount = cumulativeCount;
        });
        expect(emittedCount).toBe(count);
      });
      act(() => vi.advanceTimersByTime(8000));
      expect(burst).toHaveBeenCalledTimes(20);
      expect(create).toHaveBeenCalledOnce();
    },
  );

  it.each([0, 1])(
    "난수 %s에서도 다섯 겹이 방향을 공유하고 수평선 제한을 지켜요",
    async (random) => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(random);
      vi.spyOn(
        HTMLCanvasElement.prototype,
        "getBoundingClientRect",
      ).mockReturnValue(new DOMRect(0, 0, 358, 106));
      await showBanner();
      const upwardAngle = (Math.atan2(159, 232.7) * 180) / Math.PI;
      expect(randomSpy).toHaveBeenCalledTimes(4);
      for (const [index, [options]] of burst.mock.calls.entries()) {
        const baseAngle = index < 5 ? 180 - upwardAngle : upwardAngle;
        expect(options.angle).toBeCloseTo(baseAngle - 15 + random * 30);
        expect(options.angle - options.spread / 2).toBeGreaterThanOrEqual(0);
        expect(options.angle + options.spread / 2).toBeLessThanOrEqual(180);
      }
      const total = burst.mock.calls.reduce(
        (sum, [options]) => sum + options.particleCount,
        0,
      );
      expect(total).toBe(90);
    },
  );

  it.each([358, 952])(
    "너비 %s에서 양쪽과 다음 발사의 방향을 각각 새로 뽑아요",
    async (width) => {
      vi.spyOn(
        HTMLCanvasElement.prototype,
        "getBoundingClientRect",
      ).mockReturnValue(new DOMRect(0, 0, width, 106));
      const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
      random
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(1);
      await showBanner();
      const upwardAngle = (Math.atan2(159, width * 0.65) * 180) / Math.PI;
      for (let index = 0; index < 5; index++) {
        expect(burst.mock.calls[index][0].angle).toBeCloseTo(
          180 - upwardAngle - 15,
        );
        expect(burst.mock.calls[index + 5][0].angle).toBeCloseTo(
          upwardAngle + 15,
        );
      }
      act(() => vi.advanceTimersByTime(8000));
      expect(random).toHaveBeenCalledTimes(8);
      expect(burst.mock.calls[10][0].angle).toBeCloseTo(180 - upwardAngle);
      expect(burst.mock.calls[15][0].angle).toBeCloseTo(upwardAngle);
    },
  );

  it("닫으면 즉시 멈추고 캔버스와 타이머를 정리해요", async () => {
    const { rerender } = await showBanner();
    rerender(<Banner visible={false} />);
    expect(reset).toHaveBeenCalled();
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(16000));
    expect(burst).toHaveBeenCalledTimes(10);
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
    expect(burst).toHaveBeenCalledTimes(10);
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
    expect(burst).toHaveBeenCalledTimes(10);
    act(() => {
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(16000);
    });
    expect(reset).toHaveBeenCalled();
    expect(burst).toHaveBeenCalledTimes(10);
  });

  it("스크롤로 카드가 화면 밖으로 나가면 멈춰요", async () => {
    await showBanner();
    act(() => {
      intersect(false);
      vi.advanceTimersByTime(16000);
    });
    expect(reset).toHaveBeenCalled();
    expect(burst).toHaveBeenCalledTimes(10);
  });
});
