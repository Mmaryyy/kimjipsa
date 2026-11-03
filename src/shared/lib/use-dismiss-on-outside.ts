"use client";

import { useEffect, type RefObject } from "react";

export function useDismissOnOutside(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  close: (event: MouseEvent | KeyboardEvent) => void,
) {
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        close(event);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(event);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [rootRef, open, close]);
}
