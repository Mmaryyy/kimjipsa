"use client";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-body-sm leading-[1.55]",
      "group-[.is-user]:ml-auto group-[.is-user]:max-w-[80%] group-[.is-user]:rounded-[calc(var(--r-control)*5)]",
      "group-[.is-user]:bg-accent-soft group-[.is-user]:px-4 group-[.is-user]:py-3",
      "group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
