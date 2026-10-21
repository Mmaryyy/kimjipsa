"use client";

import type { CreateTypes, Options } from "canvas-confetti";
import { useEffect, useRef } from "react";

// 출발 뭉치가 잘리도록 카드 바깥에 두는 가로·세로 여백이에요.
const originOffsetX = 0.15;
const originOffsetY = 0.5;
// 데스크톱 전체 입자 수를 적용하는 카드 너비 기준이에요.
const desktopParticleMinWidth = 600;
// 목표 거리 대비 초기 속도 배율이에요.
const velocityScale = 0.045;
const spreadScale = 3;
const maxSpread = 100;
// 속도 감쇠·중력·입자 수명으로 천천히 내려앉게 해요.
const decay = 0.975;
const gravity = 0.1;
const ticks = 150;
// 한 번 터뜨릴 때의 기준 전체 입자 수예요.
const desktopParticleCount = 130;
const mobileParticleCount = 90;
// 매 발사 지점마다 방향·퍼짐을 한 번 정하고 다섯 겹이 공유해요.
const angleVariation = 15;
const spreadVariation = 10;
// Realistic Look의 spread 100·속도 45를 카드 기준값에 대한 배율로 바꿔요.
// 비율 합은 1이며, decay·scalar 생략 시 기존 카드 기본값을 써요.
const realisticLayers = [
  { ratio: 0.25, spreadScale: 26 / 100, velocityScale: 55 / 45 },
  { ratio: 0.2, spreadScale: 60 / 100, velocityScale: 1 },
  {
    ratio: 0.35,
    spreadScale: 1,
    velocityScale: 1,
    decay: 0.91,
    scalar: 0.8,
  },
  {
    ratio: 0.1,
    spreadScale: 120 / 100,
    velocityScale: 25 / 45,
    decay: 0.92,
    scalar: 1.2,
  },
  { ratio: 0.1, spreadScale: 120 / 100, velocityScale: 1 },
] as const;
// 카드가 보이는 동안 반복하는 간격이에요.
const burstIntervalMs = 8000;

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomDirectionOptions(angle: number, spread: number) {
  return {
    angle: Math.max(
      0,
      Math.min(180, angle + randomInRange(-angleVariation, angleVariation)),
    ),
    spread: randomInRange(
      Math.max(0, spread - spreadVariation),
      spread + spreadVariation,
    ),
  };
}

function fireRealisticBurst(
  confetti: CreateTypes,
  options: Options,
  origin: NonNullable<Options["origin"]>,
  angle: number,
  spread: number,
  count: number,
  startVelocity: number,
) {
  const direction = randomDirectionOptions(angle, spread);
  const upwardSpread = 2 * Math.min(direction.angle, 180 - direction.angle);
  let cumulativeRatio = 0;
  let emittedCount = 0;
  for (const {
    ratio,
    spreadScale,
    velocityScale,
    ...appearance
  } of realisticLayers) {
    cumulativeRatio += ratio;
    // 누적 비율을 반올림해 작은 개수에서도 전체 입자 수를 유지해요.
    const cumulativeCount = Math.round(count * cumulativeRatio);
    void confetti({
      ...options,
      ...appearance,
      origin,
      angle: direction.angle,
      // 각 겹에 배율을 적용한 뒤 부채꼴 양 끝을 수평선 위로 제한해요.
      spread: Math.min(upwardSpread, direction.spread * spreadScale),
      startVelocity: startVelocity * velocityScale,
      particleCount: cumulativeCount - emittedCount,
    });
    emittedCount = cumulativeCount;
  }
}

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
      if (!allowed() || !confetti || !canvas) return;
      const styles = getComputedStyle(document.documentElement);
      const colors = colorTokens
        .map((token) => styles.getPropertyValue(token).trim())
        .filter(Boolean);
      if (!colors.length) return;
      const { width, height } = canvas.getBoundingClientRect();
      const horizontalDistance = width * (0.5 + originOffsetX);
      const verticalDistance = height * (1 + originOffsetY);
      const targetDistance = Math.hypot(horizontalDistance, verticalDistance);
      const upwardAngle =
        (Math.atan2(verticalDistance, horizontalDistance) * 180) / Math.PI;
      const particleCount =
        width > desktopParticleMinWidth
          ? desktopParticleCount
          : mobileParticleCount;
      const rightParticleCount = Math.ceil(particleCount / 2);
      const spread = Math.min(maxSpread, upwardAngle * spreadScale);
      const options: Options = {
        // 카드 밖에서 퍼진 입자가 반대쪽 끝과 위쪽까지 들어오게 해요.
        decay,
        gravity,
        ticks,
        disableForReducedMotion: true,
        colors,
      };
      const startVelocity = targetDistance * velocityScale;
      fireRealisticBurst(
        confetti,
        options,
        { x: 1 + originOffsetX, y: 1 + originOffsetY },
        180 - upwardAngle,
        spread,
        rightParticleCount,
        startVelocity,
      );
      fireRealisticBurst(
        confetti,
        options,
        { x: -originOffsetX, y: 1 + originOffsetY },
        upwardAngle,
        spread,
        particleCount - rightParticleCount,
        startVelocity,
      );
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
        timer = setInterval(burst, burstIntervalMs);
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
