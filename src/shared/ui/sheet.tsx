"use client";
import { cn } from "@/shared/lib";

import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { TextButton } from "./text-button";
import type { OverlayProps } from "./overlay.types";
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  theme,
  children,
  action,
  closeLabel = "닫기",
  closePosition = "start",
  odId,
  closeOdId,
}: OverlayProps & {
  children: ReactNode;
  action?: ReactNode;
  closeLabel?: string;
  closePosition?: "start" | "end";
  odId?: string;
  closeOdId?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="kj-overlay" />
        <Dialog.Content
          className={cn([
            "fixed bottom-0 left-0 z-81 max-h-[var(--sheet-mobile-max-height)] w-full overflow-y-auto",
            "bg-background px-4 pt-0 pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))] text-foreground",
            "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] animate-sheet-in md:top-1/2",
            "md:bottom-auto md:left-1/2 md:max-h-[var(--sheet-desktop-max-height)] md:w-130",
            "md:-translate-1/2 motion-reduce:animate-none",
          ])}
          data-theme={theme}
          data-od-id={odId}
        >
          <header
            className={cn([
              "sticky top-0 z-1 grid min-h-12 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2",
              "bg-background [&>:first-child]:justify-self-start [&>:last-child]:justify-self-end",
            ])}
          >
            {closePosition === "start" && (
              <Dialog.Close asChild>
                <TextButton data-od-id={closeOdId}>{closeLabel}</TextButton>
              </Dialog.Close>
            )}
            {closePosition === "end" && <div />}
            <Dialog.Title className="text-headline">{title}</Dialog.Title>
            <div>
              {action}
              {closePosition === "end" && (
                <Dialog.Close asChild>
                  <TextButton data-od-id={closeOdId}>{closeLabel}</TextButton>
                </Dialog.Close>
              )}
            </div>
          </header>
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
