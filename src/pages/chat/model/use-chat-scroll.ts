"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useChatScroll() {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const onScroll = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    following.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setAwayFromBottom(!following.current);
  }, []);
  const onLatest = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    following.current = true;
    element.scrollTop = element.scrollHeight;
    setAwayFromBottom(false);
  }, []);
  useEffect(() => {
    const element = viewport.current;
    const messages = content.current;
    if (!element || !messages) return;
    const observer = new ResizeObserver(() => {
      if (following.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    observer.observe(messages);
    return () => observer.disconnect();
  }, []);
  return {
    viewportRef: viewport,
    contentRef: content,
    onScroll,
    onLatest,
    awayFromBottom,
  };
}
