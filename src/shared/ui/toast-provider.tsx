"use client";
import { cn } from "@/shared/lib";

import { Toast as ToastPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { useTopSheetLayer } from "./use-sheet-layer";

export function ToastProvider({ children }: { children: ReactNode }) {
  const layer = Math.max(90, useTopSheetLayer() + 3);
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport
        style={{ zIndex: layer }}
        className={cn([
          "fixed bottom-[calc(var(--toast-offset)+env(safe-area-inset-bottom))] left-1/2",
          "w-max max-w-[calc(100%-var(--sp-8))] -translate-x-1/2 list-none p-0 lg:bottom-8",
        ])}
        label="알림 ({hotkey})"
      />
    </ToastPrimitive.Provider>
  );
}
