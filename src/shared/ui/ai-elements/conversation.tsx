"use client";

import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import { cn } from "@/shared/lib";
import { Button } from "../button";

// The caller restores paginated anchors and follows new messages without motion.
export const Conversation = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "relative flex min-h-0 flex-1 flex-col overflow-hidden",
      className,
    )}
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
}: ConversationContentProps) => (
  <div
    ref={viewportRef}
    className={cn("min-h-0 flex-1 overflow-y-auto", scrollClassName)}
    {...props}
  >
    <div ref={contentRef} className={cn("flex flex-col gap-4 p-4", className)}>
      {children}
    </div>
  </div>
);

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
      className={cn("mt-1 mb-3 shrink-0 self-center rounded-full", className)}
      {...props}
    >
      <ArrowDownIcon aria-hidden="true" className="size-4" />
      {children}
    </Button>
  );
