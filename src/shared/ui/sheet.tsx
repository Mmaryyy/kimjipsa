"use client";
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
          className="kj-sheet"
          data-theme={theme}
          data-od-id={odId}
        >
          <header className="kj-sheet-head">
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
