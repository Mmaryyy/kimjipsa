"use client";
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";
import { messageContentStyles, messageStyles } from "./message.variants";

export type MessageProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageStyles> & {
    from: "user" | "assistant";
  };

export const Message = ({
  className,
  from,
  variant,
  ...props
}: MessageProps) => (
  <div
    className={cn(
      messageStyles({ variant }),
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentStyles>;

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div className={cn(messageContentStyles({ variant }), className)} {...props}>
    {children}
  </div>
);
