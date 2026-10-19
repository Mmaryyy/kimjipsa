"use client";
import { cn } from "@/shared/lib";

import { Toast as ToastPrimitive } from "radix-ui";
import { Button } from "./button";

type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  theme?: "light" | "dark";
};
export function Toast({
  open,
  onOpenChange,
  message,
  action,
  duration = 5000,
  theme,
}: ToastProps) {
  const persistent = duration === Infinity;
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className={cn([
        "grid rounded-sm bg-foreground px-[var(--toast-padding-inline)] py-[var(--toast-padding-block)]",
        "text-left text-[length:var(--text-subhead)] leading-[var(--lh-body)] font-medium",
        "text-background [overflow-wrap:anywhere]",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=end]:opacity-0",
      ])}
      data-theme={theme}
    >
      <ToastPrimitive.Title>{message}</ToastPrimitive.Title>
      {(action || persistent) && (
        <div className="flex flex-nowrap justify-start gap-3">
          {action && (
            <ToastPrimitive.Action asChild altText={action.label}>
              <Button
                variant="toast"
                className="min-h-11 shrink-0 whitespace-nowrap"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            </ToastPrimitive.Action>
          )}
          {persistent && (
            <ToastPrimitive.Close asChild>
              <Button
                variant="toast"
                className="min-h-11 shrink-0 whitespace-nowrap"
                aria-label="알림 닫기"
              >
                닫기
              </Button>
            </ToastPrimitive.Close>
          )}
        </div>
      )}
    </ToastPrimitive.Root>
  );
}
