import { useEffect, useState } from "react";

export function useNavigationScroll() {
  const [scrolling, setScrolling] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.visualViewport;
    let previous = window.scrollY;
    let travel = 0;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const root = document.documentElement;
      if (
        root.dataset.navigationScrollLocked === "true" ||
        performance.now() <
          Number(root.dataset.navigationScrollRestoreUntil ?? 0)
      ) {
        previous = y;
        travel = 0;
        return;
      }
      const delta = y - previous;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      previous = y;
      const atEdge =
        y === 0 ||
        y + window.innerHeight >= document.documentElement.scrollHeight - 1;
      if (atEdge || reduced.matches) {
        setCollapsed(false);
        travel = 0;
      } else if (Math.abs(travel) >= 8) {
        setCollapsed(travel > 0);
        travel = 0;
      }
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 500);
    };
    const onViewport = () => {
      const editing = document.activeElement?.matches(
        "input, textarea, [contenteditable=true]",
      );
      setKeyboardOpen(
        Boolean(
          editing && viewport && window.innerHeight - viewport.height > 150,
        ),
      );
    };
    const onReduced = () => {
      if (reduced.matches) setCollapsed(false);
    };
    onViewport();
    window.addEventListener("scroll", onScroll, { passive: true });
    viewport?.addEventListener("resize", onViewport);
    document.addEventListener("focusin", onViewport);
    document.addEventListener("focusout", onViewport);
    reduced.addEventListener?.("change", onReduced);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      viewport?.removeEventListener("resize", onViewport);
      document.removeEventListener("focusin", onViewport);
      document.removeEventListener("focusout", onViewport);
      reduced.removeEventListener?.("change", onReduced);
    };
  }, []);
  return { scrolling, collapsed, keyboardOpen };
}
