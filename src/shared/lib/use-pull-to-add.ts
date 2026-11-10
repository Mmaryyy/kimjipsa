"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useMediaQuery } from "./use-media-query";

export const PULL_TO_ADD_THRESHOLD = 72;
const inputSelector =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isBlocked(root: HTMLElement, target: EventTarget | null) {
  if (
    window.scrollY > 0 ||
    (document.scrollingElement?.scrollTop ?? 0) > 0 ||
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], dialog[open]',
    ) ||
    document.activeElement?.matches(inputSelector)
  )
    return true;
  let element = target instanceof Element ? target : null;
  if (element?.closest(inputSelector)) return true;
  while (element) {
    if (element.scrollTop > 0) return true;
    if (element === root) break;
    element = element.parentElement;
  }
  return false;
}

export function usePullToAdd(onAdd: () => void, disabled = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const coarse = useMediaQuery("(pointer: coarse)");
  const onRelease = useEffectEvent(onAdd);
  const unavailable = useEffectEvent(() => disabled);

  useEffect(() => {
    const root = ref.current;
    if (!root || !coarse) return;
    let start: { x: number; y: number; target: EventTarget | null } | null =
      null;
    let pulled = 0;
    const reset = () => {
      start = null;
      pulled = 0;
      setDistance(0);
    };
    const onStart = (event: TouchEvent) => {
      reset();
      if (
        event.touches.length !== 1 ||
        unavailable() ||
        isBlocked(root, event.target)
      )
        return;
      const touch = event.touches[0]!;
      start = { x: touch.clientX, y: touch.clientY, target: event.target };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      if (
        event.touches.length !== 1 ||
        unavailable() ||
        isBlocked(root, start.target)
      ) {
        reset();
        return;
      }
      const touch = event.touches[0]!;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = touch.clientY - start.y;
      if (dx > Math.abs(dy) || dy < 0) {
        reset();
        return;
      }
      if (dy < 6) {
        pulled = 0;
        setDistance(0);
        return;
      }
      if (!event.cancelable) {
        reset();
        return;
      }
      event.preventDefault();
      pulled = dy;
      setDistance(dy);
    };
    const onEnd = (event: TouchEvent) => {
      const trigger =
        start &&
        event.touches.length === 0 &&
        pulled >= PULL_TO_ADD_THRESHOLD &&
        !unavailable() &&
        !isBlocked(root, start.target);
      reset();
      // iOS 키보드가 열리도록 사용자 touchend 안에서 동기적으로 실행해요.
      if (trigger) onRelease();
    };
    const scrolling = document.documentElement;
    const previous = scrolling.style.overscrollBehaviorY;
    scrolling.style.overscrollBehaviorY = "none";
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", reset);
    return () => {
      scrolling.style.overscrollBehaviorY = previous;
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", reset);
    };
  }, [coarse]);

  return { ref, distance, ready: distance >= PULL_TO_ADD_THRESHOLD };
}
