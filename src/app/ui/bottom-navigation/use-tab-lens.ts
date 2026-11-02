"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  advanceTabSpring,
  cancelTabGesture,
  nearestTab,
  tabLensShape,
  liquidTabMotionTokens as tokens,
} from "@/shared/lib";

export function useTabLens(hrefs: readonly string[]) {
  const nav = useRef<HTMLElement>(null);
  const router = useRouter();
  const suppressClick = useRef(false);
  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const rail = element.querySelector<HTMLElement>("[data-rail]")!;
    const lens = element.querySelector<HTMLElement>("[data-lens]")!;
    const original = element.querySelector<HTMLElement>("[data-original]")!;
    const copy = element.querySelector<HTMLElement>("[data-copy]")!;
    let selected = element.querySelector<HTMLAnchorElement>(
      "[aria-current=page]",
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const forced = window.matchMedia("(forced-colors: active)");
    let width = 0;
    let cell = 0;
    let selectedX = 0;
    let x = 0,
      vx = 0,
      lift = 0,
      vlift = 0,
      stretch = 0;
    let target = 0,
      frame = 0,
      previous = 0;
    let pointer: {
      id: number;
      x: number;
      y: number;
      dragging: boolean;
    } | null = null;
    let selection = selected?.querySelector<HTMLElement>("[data-selection]");
    const faces = copy.querySelectorAll<HTMLElement>("[data-face]");
    const measure = (reset = true) => {
      selected = element.querySelector<HTMLAnchorElement>(
        "[aria-current=page]",
      );
      selection = selected?.querySelector<HTMLElement>("[data-selection]");
      width = original.getBoundingClientRect().width;
      cell = width / hrefs.length;
      const index = selected
        ? Array.from(original.querySelectorAll("a")).indexOf(selected)
        : -1;
      selectedX = (Math.max(0, index) + 0.5) * cell;
      if (reset) x = target = selectedX;
      element.style.setProperty("--tab-cell", `${cell}px`);
      document.documentElement.style.setProperty(
        "--bottom-navigation-measured-height",
        `${element.offsetHeight}px`,
      );
    };
    const paint = () => {
      const shape = tabLensShape(lift, stretch, reduced.matches);
      const show = !forced.matches && !reduced.matches && lift > 0.001;
      rail.style.transform = `scale(${shape.rail})`;
      lens.style.transform = `translateX(${x - cell / 2}px) scale(${shape.width}, ${shape.height})`;
      lens.style.opacity = show ? `${lift}` : "0";
      const left = x - (cell * shape.width) / 2;
      const right = x + (cell * shape.width) / 2;
      const mask = `linear-gradient(to right, transparent ${left}px, var(--glass-text) ${left}px, var(--glass-text) ${right}px, transparent ${right}px)`;
      copy.style.maskImage = show ? mask : "none";
      copy.style.opacity = show ? `${lift}` : "0";
      original.style.maskImage = show
        ? `linear-gradient(to right, var(--glass-text) ${left}px, transparent ${left}px, transparent ${right}px, var(--glass-text) ${right}px)`
        : "none";
      faces.forEach((face) => {
        face.style.transform = `scale(${shape.content})`;
      });
      if (selection) selection.style.opacity = show ? `${1 - lift}` : "1";
    };
    const tick = (time: number) => {
      const dt = Math.min((time - (previous || time - 16)) / 1000, 0.032);
      previous = time;
      const position = advanceTabSpring(
        x,
        vx,
        target,
        dt,
        pointer ? tokens.follow : tokens.settle,
        reduced.matches,
      );
      x = position.value;
      vx = position.velocity;
      const elevation = advanceTabSpring(
        lift,
        vlift,
        pointer ? 1 : 0,
        dt,
        tokens.lift,
        reduced.matches,
      );
      lift = elevation.value;
      vlift = elevation.velocity;
      const desiredStretch =
        Math.min(
          Math.abs(vx) / tokens.velocityStretchScale,
          tokens.maxVelocityStretch,
        ) * lift;
      stretch +=
        (desiredStretch - stretch) * (1 - Math.exp(-tokens.shapeResponse * dt));
      paint();
      if (
        Math.abs(x - target) > 0.05 ||
        Math.abs(vx) > 0.05 ||
        Math.abs(lift - (pointer ? 1 : 0)) > 0.001 ||
        Math.abs(vlift) > 0.001 ||
        stretch > 0.001
      )
        frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        previous = 0;
      }
    };
    const animate = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const cancel = () => {
      pointer = null;
      target = selectedX;
      animate();
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || pointer) return;
      measure();
      suppressClick.current = false;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
      target = Math.max(
        cell / 2,
        Math.min(
          width - cell / 2,
          event.clientX - original.getBoundingClientRect().left,
        ),
      );
      animate();
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (cancelTabGesture(dx, dy, pointer.dragging)) {
        suppressClick.current = true;
        cancel();
        return;
      }
      if (Math.abs(dx) >= tokens.gesture.dragThresholdPx) {
        pointer.dragging = true;
        element.setPointerCapture(event.pointerId);
      }
      target = Math.max(
        cell / 2,
        Math.min(
          width - cell / 2,
          event.clientX - original.getBoundingClientRect().left,
        ),
      );
      animate();
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const bounds = original.getBoundingClientRect();
      const outset = tokens.gesture.releaseOutsetPx;
      const outside =
        event.clientX < bounds.left - outset ||
        event.clientX > bounds.right + outset ||
        event.clientY < bounds.top - outset ||
        event.clientY > bounds.bottom + outset;
      const moved = Math.hypot(
        event.clientX - pointer.x,
        event.clientY - pointer.y,
      );
      const accepted =
        !outside &&
        (pointer.dragging || moved <= tokens.gesture.tapTolerancePx);
      suppressClick.current = true;
      pointer = null;
      if (accepted) {
        const index = nearestTab(
          event.clientX - bounds.left,
          width,
          hrefs.length,
        );
        target = (index + 0.5) * cell;
        router.push(hrefs[index]!);
      } else target = selectedX;
      animate();
    };
    const click = (event: MouseEvent) => {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        suppressClick.current = true;
        cancel();
      }
    };
    const resize = () => {
      cancel();
      measure();
      paint();
    };
    const onCancel = () => {
      suppressClick.current = true;
      cancel();
    };
    const preference = () => {
      cancel();
      paint();
    };
    measure();
    paint();
    const routeObserver = new MutationObserver(() => {
      measure(false);
      if (!pointer) target = selectedX;
      animate();
    });
    routeObserver.observe(original, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-current"],
    });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", onCancel);
    element.addEventListener("lostpointercapture", onCancel);
    element.addEventListener("click", click, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    reduced.addEventListener("change", preference);
    forced.addEventListener("change", preference);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      routeObserver.disconnect();
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", onCancel);
      element.removeEventListener("lostpointercapture", onCancel);
      element.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", preference);
      forced.removeEventListener("change", preference);
      document.documentElement.style.removeProperty(
        "--bottom-navigation-measured-height",
      );
    };
  }, [hrefs, router]);
  return nav;
}
