"use client";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

import { AlertDialog } from "radix-ui";
import { Button } from "./button";
import type { OverlayProps } from "./overlay.types";
type ConfirmDialogProps = OverlayProps & {
  children?: ReactNode;
  targetName?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  cancelLabel?: string;
  secondaryAction?: { label: string; onClick: () => void };
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  targetName,
  description,
  confirmLabel = "삭제하기",
  onConfirm,
  pending = false,
  destructive = true,
  cancelLabel = "취소하기",
  secondaryAction,
  trigger,
  theme,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="kj-overlay" />
        <AlertDialog.Content
          className={cn([
            "fixed top-1/2 left-1/2 z-81 w-[min(calc(var(--sp-10)*7.5),calc(100%-var(--sp-6)*2))]",
            "surface-edge max-md:before:hidden md:rounded-[var(--r-dialog)] md:border md:border-[var(--glass-border)]",
            "-translate-1/2 max-md:rounded-sm bg-popover p-4 text-center text-foreground",
            "[overflow-wrap:anywhere] [&_p]:mt-1",
          ])}
          data-theme={theme}
        >
          <AlertDialog.Title className="text-headline">
            {targetName ? `‘${targetName}’ ${title}` : title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-caption text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {children}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="gray" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {secondaryAction && (
              <Button
                variant="gray"
                disabled={pending}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
            <Button
              className={secondaryAction ? "col-span-2" : undefined}
              variant={destructive ? "danger" : "primary"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "처리하고 있어요" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
