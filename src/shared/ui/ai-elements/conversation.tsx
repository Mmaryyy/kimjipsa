"use client";

import { ArrowDownIcon } from "lucide-react";
import { useCallback, type ComponentProps, type RefObject } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/shared/lib";
import { Button } from "../button";

// The caller restores paginated anchors and follows new messages without motion.
export const Conversation = ({
  className,
  ...props
}: ComponentProps<typeof StickToBottom>) => (
  <StickToBottom
    initial={false}
    resize="instant"
    targetScrollTop={(_, { scrollElement }) => scrollElement.scrollTop}
    className={cn("relative min-h-0 flex-1 overflow-hidden", className)}
    {...props}
  />
);

type ConversationContentProps = ComponentProps<"div"> & {
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  scrollClassName?: string;
};

export const ConversationContent = ({
  viewportRef,
  contentRef,
  scrollClassName,
  className,
  children,
  ...props
}: ConversationContentProps) => {
  const { scrollRef, contentRef: stickContentRef } = useStickToBottomContext();
  const setViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      scrollRef(element);
    },
    [viewportRef, scrollRef],
  );
  const setContent = useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element;
      stickContentRef(element);
    },
    [contentRef, stickContentRef],
  );
  return (
    <div
      ref={setViewport}
      className={cn("h-full overflow-y-auto", scrollClassName)}
      {...props}
    >
      <div
        ref={setContent}
        className={cn("flex flex-col gap-4 p-4", className)}
      >
        {children}
      </div>
    </div>
  );
};

export const ConversationScrollButton = ({
  visible,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { visible: boolean }) =>
  visible && (
    <Button
      variant="gray"
      size="sm"
      className={cn(
        "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full",
        className,
      )}
      {...props}
    >
      <ArrowDownIcon aria-hidden="true" className="size-4" />
      {children}
    </Button>
  );
