"use client";

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
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className="kj-toast"
      data-theme={theme}
    >
      <ToastPrimitive.Title>{message}</ToastPrimitive.Title>
      <div className="flex justify-end gap-2">
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
        <ToastPrimitive.Close asChild>
          <Button
            variant="toast"
            className="min-h-11 shrink-0 whitespace-nowrap"
            aria-label="알림 닫기"
          >
            닫기
          </Button>
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
}
