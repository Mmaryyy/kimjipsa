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
}: OverlayProps & {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="kj-overlay" />
        <Dialog.Content className="kj-sheet" data-theme={theme}>
          <header className="kj-sheet-head">
            <Dialog.Close asChild>
              <TextButton>닫기</TextButton>
            </Dialog.Close>
            <Dialog.Title className="text-headline">{title}</Dialog.Title>
            <div>{action}</div>
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
