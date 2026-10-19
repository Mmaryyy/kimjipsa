"use client";

import { useEffect, useRef } from "react";
import type { CreateTypes } from "canvas-confetti";

const colorTokens = [
  "--sys-pink",
  "--sys-purple",
  "--sys-blue",
  "--sys-green",
  "--sys-orange",
] as const;

/** 홈 축하 배너가 보이는 동안만 하나의 캔버스와 반복 타이머를 유지해요. */
export function useConfettiBurst(enabled: boolean) {
  const bannerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!enabled || !banner || !window.matchMedia) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let inView = false;
    let confetti: CreateTypes | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let loading: Promise<void> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    const allowed = () =>
      !disposed &&
      inView &&
      !motion.matches &&
      document.visibilityState === "visible";
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      confetti?.reset();
    };
    const burst = () => {
      if (!allowed() || !confetti) return;
      const styles = getComputedStyle(document.documentElement);
      const colors = colorTokens
        .map((token) => styles.getPropertyValue(token).trim())
        .filter(Boolean);
      if (!colors.length) return;
      void confetti({
        particleCount: 70,
        spread: 75,
        startVelocity: 28,
        disableForReducedMotion: true,
        colors,
        origin: {
          x: 0.5,
          y: 0,
        },
      });
    };
    const start = async () => {
      if (!allowed() || timer !== undefined) return;
      loading ??= import("canvas-confetti").then(({ default: library }) => {
        if (disposed) return;
        canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
        banner.append(canvas);
        confetti = library.create(canvas, { resize: true });
      });
      try {
        await loading;
        if (!allowed() || timer !== undefined) return;
        burst();
        timer = setInterval(burst, 8000);
      } catch {
        // 장식 로딩 실패가 카드 표시나 닫기를 막지 않아요.
      }
    };
    const sync = () => {
      if (allowed()) void start();
      else stop();
    };
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(banner);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      canvas?.remove();
    };
  }, [enabled]);

  return bannerRef;
}
