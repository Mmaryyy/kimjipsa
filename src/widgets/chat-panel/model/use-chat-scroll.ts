"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Chat } from "@/entities/chat-message";

interface Options {
  scope: string;
  messages: Chat["messages"] | undefined;
  hasOlder: boolean;
  fetching: boolean;
  olderFailed: boolean;
  onLoadOlder: () => Promise<unknown>;
}

export function useChatScroll({
  scope,
  messages,
  hasOlder,
  fetching,
  olderFailed,
  onLoadOlder,
}: Options) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const initialized = useRef(false);
  const currentScope = useRef(scope);
  const loading = useRef(false);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const rememberPosition = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    const visible = Array.from(
      element.querySelectorAll<HTMLElement>("[data-message-id]"),
    ).find((message) => message.getBoundingClientRect().bottom > top);
    anchor.current = visible
      ? {
          id: visible.dataset.messageId!,
          offset: visible.getBoundingClientRect().top - top,
        }
      : null;
  }, []);
  const restorePosition = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    if (following.current) element.scrollTop = element.scrollHeight;
    else if (anchor.current) {
      const message = element.querySelector<HTMLElement>(
        `[data-message-id="${anchor.current.id}"]`,
      );
      if (message)
        element.scrollTop +=
          message.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          anchor.current.offset;
    }
    rememberPosition();
  }, [rememberPosition]);
  const onOlder = useCallback(async () => {
    if (!hasOlder || fetching || loading.current) return;
    loading.current = true;
    following.current = false;
    rememberPosition();
    try {
      await onLoadOlder();
    } finally {
      loading.current = false;
    }
  }, [hasOlder, fetching, onLoadOlder, rememberPosition]);
  const onScroll = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    following.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setAwayFromBottom(!following.current);
    rememberPosition();
    if (
      initialized.current &&
      element.scrollTop < 80 &&
      !following.current &&
      !olderFailed
    )
      void onOlder();
  }, [onOlder, olderFailed, rememberPosition]);
  const onLatest = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    following.current = true;
    element.scrollTop = element.scrollHeight;
    setAwayFromBottom(false);
    rememberPosition();
  }, [rememberPosition]);
  useLayoutEffect(() => {
    if (currentScope.current !== scope) {
      currentScope.current = scope;
      initialized.current = false;
      following.current = true;
      anchor.current = null;
      setAwayFromBottom(false);
    }
    if (messages?.length) initialized.current = true;
    restorePosition();
  }, [scope, messages, fetching, restorePosition]);
  useEffect(() => {
    const element = viewport.current;
    const messages = content.current;
    if (!element || !messages) return;
    const observer = new ResizeObserver(restorePosition);
    observer.observe(element);
    observer.observe(messages);
    return () => observer.disconnect();
  }, [restorePosition]);
  return {
    viewportRef: viewport,
    contentRef: content,
    onScroll,
    onLatest,
    onOlder,
    awayFromBottom,
  };
}
