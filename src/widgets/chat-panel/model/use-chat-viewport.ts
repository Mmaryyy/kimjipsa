"use client";
import { useLayoutEffect, type RefObject } from "react";

export function useChatViewport(contentRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const body = document.body;
    const lockDocument = window.matchMedia(
      "(max-width: 767px), (pointer: coarse)",
    ).matches;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const rootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };
    const bodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
    };
    if (lockDocument) {
      root.dataset.navigationScrollLocked = "true";
      Object.assign(root.style, {
        overflow: "hidden",
        overscrollBehavior: "none",
      });
      Object.assign(body.style, {
        overflow: "hidden",
        position: "fixed",
        top: `${-scrollY}px`,
        left: `${-scrollX}px`,
        width: "100%",
      });
    }
    const update = () => {
      // iOS 입력 포커스가 남긴 창 스크롤은 고정한 문서의 위치와 분리해요.
      if (lockDocument && (window.scrollX !== 0 || window.scrollY !== 0)) {
        window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      }
      root.style.setProperty(
        "--chat-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty(
        "--chat-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    const onTouchMove = (event: TouchEvent) => {
      const panel = contentRef.current?.closest('[role="dialog"]');
      if (!(event.target instanceof Node) || !panel?.contains(event.target)) {
        event.preventDefault();
      }
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    if (lockDocument)
      document.addEventListener("touchmove", onTouchMove, {
        passive: false,
        capture: true,
      });
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("touchmove", onTouchMove, true);
      root.style.removeProperty("--chat-viewport-height");
      root.style.removeProperty("--chat-viewport-top");
      if (lockDocument) {
        root.dataset.navigationScrollRestoreUntil = String(
          performance.now() + 100,
        );
        Object.assign(root.style, rootStyles);
        Object.assign(body.style, bodyStyles);
        window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
        delete root.dataset.navigationScrollLocked;
      }
    };
  }, [contentRef]);
}
