"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import { TextButton } from "./text-button";

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
      {action && (
        <ToastPrimitive.Action asChild altText={action.label}>
          <TextButton className="kj-toast-action" onClick={action.onClick}>
            {action.label}
          </TextButton>
        </ToastPrimitive.Action>
      )}
      <ToastPrimitive.Close asChild>
        <TextButton className="kj-toast-action" aria-label="알림 닫기">
          닫기
        </TextButton>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}
