"use client";
import { cn, useMediaQuery } from "@/shared/lib";

import { Dialog } from "radix-ui";
import { SheetHeader } from "./sheet-header";
import { Drawer } from "./drawer";
import { sheetStyles } from "./sheet.variants";
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
  presentation = "sheet",
  onEscapeKeyDown,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={cn("kj-overlay", overlayClassName)} />
        <Dialog.Content
          aria-modal="true"
          className={cn(sheetStyles({ presentation }), className)}
          onEscapeKeyDown={onEscapeKeyDown}
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
  if (coarse && props.presentation !== "panel") {
    return <Drawer {...props} />;
  }
  return <DesktopSheet {...props} />;
}
