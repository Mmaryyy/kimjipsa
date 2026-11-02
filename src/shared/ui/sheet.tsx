"use client";
import { cn, useMediaQuery } from "@/shared/lib";

import { Dialog } from "radix-ui";
import { SheetHeader } from "./sheet-header";
import { Drawer } from "./drawer";
import type { SheetProps } from "./overlay.types";
function DesktopSheet({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  theme,
  children,
  action,
  leadingAction,
  showCloseButton = false,
  odId,
  className,
  onCloseAutoFocus,
  onOpenAutoFocus,
  hideHeader = false,
  overlayClassName,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={cn("kj-overlay", overlayClassName)} />
        <Dialog.Content
          className={cn([
            "fixed bottom-0 left-0 z-81 max-h-[var(--sheet-mobile-max-height)]",
            "w-full overflow-x-hidden overflow-y-auto",
            "bg-background px-4 pt-0 pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))] text-foreground",
            "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] animate-sheet-in md:top-1/2",
            "md:bottom-auto md:left-1/2 md:max-h-[var(--sheet-desktop-max-height)] md:w-130",
            "md:-translate-1/2 motion-reduce:animate-none",
            className,
          ])}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={onOpenAutoFocus}
          data-theme={theme}
          data-od-id={odId}
        >
          {hideHeader && !showCloseButton ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className="sticky top-0 z-1 bg-background">
              <SheetHeader
                title={
                  <Dialog.Title className="text-headline">{title}</Dialog.Title>
                }
                action={action}
                leadingAction={leadingAction}
                showCloseButton={showCloseButton}
                onOpenChange={onOpenChange}
              />
            </div>
          )}
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sheet(props: SheetProps) {
  const coarse = useMediaQuery("(pointer: coarse)");
  if (coarse) {
    return <Drawer {...props} />;
  }
  return <DesktopSheet {...props} />;
}
