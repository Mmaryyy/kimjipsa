"use client";
import { useLayoutEffect, useRef } from "react";
import { useChatNavigation } from "@/features/chat-navigation";
import { chatPath } from "@/shared/config";
import { useRouter } from "next/navigation";
import {
  advanceTabSpring,
  cancelTabGesture,
  nearestTab,
  targetLiquidTab,
  liquidTabMotionTokens as tokens,
} from "@/shared/lib";

export function useTabLens(hrefs: readonly string[]) {
  const nav = useRef<HTMLElement>(null);
  const router = useRouter();
  const { onOpen } = useChatNavigation();
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element) return;
    const original = element.querySelector<HTMLElement>("[data-original]")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const forced = window.matchMedia("(forced-colors: active)");
    const state = {
      x: 0,
      target: 0,
      velocity: 0,
      selectionScale: 1,
      lift: 0,
      liftVelocity: 0,
      sx: 1,
      sy: 1,
    };
    let bounds = {
      height: 0,
      step: 0,
      max: 0,
      left: 0,
      center: 0,
      viewportWidth: 0,
    };
    let selectedX = 0;
    let selected = false;
    let frame = 0;
    let previous = 0;
    let suppressClick = false;
    let clickReset: ReturnType<typeof setTimeout> | undefined;
    let pendingIndex: number | null = null;
    let routeReset: ReturnType<typeof setTimeout> | undefined;
    const suppressPointerClick = () => {
      suppressClick = true;
      clearTimeout(clickReset);
      clickReset = setTimeout(() => {
        suppressClick = false;
      }, 500);
    };
    let pointer: {
      id: number;
      x: number;
      y: number;
      dragging: boolean;
      tapIndex: number;
    } | null = null;
    const syncRoute = () => {
      const links = Array.from(original.querySelectorAll("a"));
      const index = links.findIndex(
        (link) => link.getAttribute("aria-current") === "page",
      );
      if (pendingIndex !== null && index !== pendingIndex) return;
      pendingIndex = null;
      clearTimeout(routeReset);
      selected = index >= 0;
      selectedX = Math.max(0, index) * bounds.step;
    };
    const paint = () => {
      const reveal = forced.matches || reduced.matches ? 0 : state.lift;
      const style = element.style;
      style.setProperty("--indicator-x", `${state.x}px`);
      style.setProperty("--indicator-sx", `${state.sx}`);
      style.setProperty("--indicator-sy", `${state.sy}`);
      style.setProperty("--lens-lift", `${reveal}`);
      element.toggleAttribute("data-lens-visible", reveal > 0);
      style.setProperty(
        "--rail-scale",
        `${1 + state.lift * tokens.railExpansion}`,
      );
      style.setProperty(
        "--selection-visible",
        selected || pointer || state.lift > 0 ? "1" : "0",
      );
      if (reveal === 0) return;
      style.setProperty(
        "--lens-left",
        `${state.x + (bounds.step * (1 - state.sx)) / 2}px`,
      );
      style.setProperty(
        "--lens-top",
        `${(bounds.height * (1 - state.sy)) / 2}px`,
      );
      style.setProperty("--lens-width", `${bounds.step * state.sx}px`);
      style.setProperty("--lens-height", `${bounds.height * state.sy}px`);
      style.setProperty(
        "--lens-radius",
        `${(Math.min(bounds.step, bounds.height) * state.sx) / 2}px`,
      );
      const magnification = 1 + state.lift * tokens.contentMagnification;
      style.setProperty("--copy-sx", `${magnification / state.sx}`);
      style.setProperty("--copy-sy", `${magnification / state.sy}`);
    };
    const tick = (time: number) => {
      frame = 0;
      const moving = advanceTabSpring(
        state,
        bounds,
        Boolean(pointer),
        reduced.matches || forced.matches,
        (time - (previous || time - 16)) / 1000,
        Boolean(pointer?.dragging),
      );
      previous = time;
      paint();
      if (moving) frame = requestAnimationFrame(tick);
      else {
        previous = 0;
        delete element.dataset.animating;
      }
    };
    const animate = () => {
      element.dataset.animating = "true";
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const endGesture = () => {
      const current = pointer;
      pointer = null;
      if (current && element.hasPointerCapture(current.id))
        element.releasePointerCapture(current.id);
    };
    const cancel = () => {
      if (!pointer) return;
      suppressPointerClick();
      endGesture();
      targetLiquidTab(state, selectedX, bounds.step);
      animate();
    };
    const lostCapture = (event: PointerEvent) => {
      if (event.target === element && pointer) cancel();
    };
    const measure = () => {
      cancel();
      const step = original.clientWidth / hrefs.length;
      bounds = {
        height: original.clientHeight,
        step,
        max: step * (hrefs.length - 1),
        left: original.offsetLeft,
        center: element.clientWidth / 2,
        viewportWidth: window.innerWidth,
      };
      syncRoute();
      state.x = state.target = selectedX;
      state.velocity = state.lift = state.liftVelocity = 0;
      state.sx = state.sy = state.selectionScale = 1;
      element.style.setProperty("--tab-cell", `${step}px`);
      document.documentElement.style.setProperty(
        "--bottom-navigation-measured-height",
        `${element.offsetHeight}px`,
      );
      paint();
    };
    const position = (clientX: number) => {
      const box = element.getBoundingClientRect();
      const localX = (clientX - box.left) * (element.clientWidth / box.width);
      const x =
        bounds.center +
        (localX - bounds.center) / (1 + state.lift * tokens.railExpansion);
      return Math.max(
        0,
        Math.min(bounds.max, x - bounds.left - bounds.step / 2),
      );
    };
    const down = (event: PointerEvent) => {
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        pointer ||
        !bounds.step
      )
        return;
      const link = (event.target as Element).closest("a");
      const tapIndex = Array.from(original.querySelectorAll("a")).findIndex(
        (item) => item === link,
      );
      if (tapIndex < 0) return;
      suppressClick = false;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        tapIndex,
      };
      targetLiquidTab(state, tapIndex * bounds.step, bounds.step);
      animate();
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (cancelTabGesture(dx, dy, pointer.dragging)) {
        cancel();
        return;
      }
      if (!pointer.dragging) {
        if (Math.abs(dx) < tokens.gesture.dragThresholdPx) return;
        pointer.dragging = true;
        state.selectionScale = 1;
        element.setPointerCapture(event.pointerId);
      }
      state.target = position(event.clientX);
      animate();
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const box = original.getBoundingClientRect();
      const outset = tokens.gesture.releaseOutsetPx;
      const outside =
        event.clientX < box.left - outset ||
        event.clientX > box.right + outset ||
        event.clientY < box.top - outset ||
        event.clientY > box.bottom + outset;
      const moved = Math.hypot(
        event.clientX - pointer.x,
        event.clientY - pointer.y,
      );
      if (
        outside ||
        (!pointer.dragging && moved > tokens.gesture.tapTolerancePx)
      ) {
        cancel();
        return;
      }
      const index = pointer.dragging
        ? nearestTab(
            position(event.clientX) + bounds.step / 2,
            bounds.step * hrefs.length,
            hrefs.length,
          )
        : pointer.tapIndex;
      suppressPointerClick();
      endGesture();
      targetLiquidTab(state, index * bounds.step, bounds.step);
      animate();
      const current = original.querySelector('a[aria-current="page"]');
      pendingIndex =
        current === original.querySelectorAll("a")[index] ? null : index;
      clearTimeout(routeReset);
      if (pendingIndex !== null) {
        // 느린 이동을 기다린 뒤 실패·리디렉트된 이동의 선택을 복구해요.
        routeReset = setTimeout(() => {
          pendingIndex = null;
          syncRoute();
          if (!pointer) targetLiquidTab(state, selectedX, bounds.step);
          animate();
        }, 5000);
      }
      selectedX = index * bounds.step;
      if (hrefs[index] === chatPath) {
        pendingIndex = null;
        clearTimeout(routeReset);
        onOpen();
        syncRoute();
        targetLiquidTab(state, selectedX, bounds.step);
      } else router.push(hrefs[index]!);
    };
    const click = (event: MouseEvent) => {
      if (
        suppressClick &&
        event.detail !== 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") suppressClick = false;
      if (event.key === "Escape" && pointer) {
        event.preventDefault();
        cancel();
      }
    };
    const leave = () => {
      if (pointer && !pointer.dragging) cancel();
    };
    const visibility = () => {
      if (document.hidden) cancel();
    };
    const preference = () => {
      cancel();
      animate();
    };
    measure();
    const routeObserver = new MutationObserver(() => {
      syncRoute();
      if (!pointer) targetLiquidTab(state, selectedX, bounds.step);
      animate();
    });
    routeObserver.observe(original, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-current"],
    });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("lostpointercapture", lostCapture);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("click", click, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", measure);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", preference);
    forced.addEventListener("change", preference);
    return () => {
      endGesture();
      cancelAnimationFrame(frame);
      clearTimeout(clickReset);
      clearTimeout(routeReset);
      delete element.dataset.animating;
      observer.disconnect();
      routeObserver.disconnect();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("lostpointercapture", lostCapture);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", measure);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", preference);
      forced.removeEventListener("change", preference);
      document.documentElement.style.removeProperty(
        "--bottom-navigation-measured-height",
      );
    };
  }, [hrefs, router, onOpen]);
  return nav;
}
