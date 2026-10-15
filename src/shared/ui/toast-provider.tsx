"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import type { ReactNode } from "react";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport
        className="kj-toast-viewport"
        label="알림 ({hotkey})"
      />
    </ToastPrimitive.Provider>
  );
}
