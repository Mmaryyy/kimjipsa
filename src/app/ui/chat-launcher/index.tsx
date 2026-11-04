"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useChatNavigation } from "@/features/chat-navigation";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

const peekLines = ["...", "무엇이든 도와줄 수 있어!", "오늘 할 일 알려줄까?"];

const ChatLauncher = () => {
  const { onOpen } = useChatNavigation();
  const [peek, setPeek] = useState("");
  const [hidden, setHidden] = useState(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(scrollTimer);
      setHidden(document.activeElement !== linkRef.current);
      scrollTimer = setTimeout(() => setHidden(false), 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimer);
    };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let last = -1;
    let hideTimer: ReturnType<typeof setTimeout>;
    const show = () => {
      if (!document.hidden && !reduced.matches) {
        const index =
          (last + 1 + Math.floor(Math.random() * (peekLines.length - 1))) %
          peekLines.length;
        last = index;
        setPeek(peekLines[index]);
        hideTimer = setTimeout(() => setPeek(""), 4000);
      }
      showTimer = setTimeout(show, 25000 + Math.random() * 15000);
    };
    let showTimer = setTimeout(show, 6000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  return (
    <div
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "fixed right-4 z-40 lg:right-10 lg:bottom-6",
        // SVG 아래 투명 여백 약 2px과 합쳐 탭 위 간격을 약 4px로 맞춰요.
        "bottom-[calc(var(--bottom-navigation-offset)-var(--sp-6)+2px+env(safe-area-inset-bottom))]",
        "transition-[opacity,translate,scale] duration-[var(--dur-slow)] ease-[var(--ease)]",
        "motion-reduce:translate-none motion-reduce:scale-none motion-reduce:transition-opacity",
        hidden && "pointer-events-none translate-y-2.5 scale-95 opacity-0",
      )}
    >
      <Button
        ref={linkRef}
        tabIndex={hidden ? -1 : undefined}
        onFocus={() => setHidden(false)}
        onClick={onOpen}
        aria-label="AI 집사 채팅 열기"
        data-od-id="bot-fab"
        variant="gray"
        className={cn(
          "relative grid h-[82px] w-[88px] place-items-center overflow-visible",
          "rounded-none bg-transparent p-0 shadow-none transition-transform",
          "duration-[var(--dur-fast)] ease-[var(--ease)] active:scale-[0.94] active:opacity-100",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
          "motion-reduce:transition-none",
        )}
      >
        <Image
          src="/images/kimjipsa-house.svg"
          alt=""
          width={88}
          height={82}
          className="pointer-events-none h-[82px] w-[88px] object-contain"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-[calc(100%-10px)] left-1/2 w-max max-w-28 -translate-x-1/2",
            "rounded-control bg-card px-2 py-1 text-center text-caption-sm whitespace-normal text-muted-foreground",
            "transition-[opacity,transform] duration-[var(--dur)] ease-[var(--ease)]",
            "data-[visible=false]:translate-y-1 data-[visible=false]:opacity-0 motion-reduce:hidden",
            "after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-5",
            "after:border-b-0 after:border-transparent after:border-t-card",
          )}
          data-visible={!!peek && !hidden}
        >
          {peek}
        </span>
      </Button>
    </div>
  );
};
export default ChatLauncher;
