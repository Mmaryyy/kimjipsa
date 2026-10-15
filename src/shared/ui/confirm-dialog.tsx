"use client";
import { AlertDialog } from "radix-ui";
import { Button } from "./button";
import type { OverlayProps } from "./overlay.types";
type ConfirmDialogProps = OverlayProps & {
  targetName: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
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
  trigger,
  theme,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="kj-overlay" />
        <AlertDialog.Content className="kj-confirm-dialog" data-theme={theme}>
          <AlertDialog.Title className="text-headline">
            ‘{targetName}’ {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-caption text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="kj-confirm-dialog-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="gray" disabled={pending}>
                취소하기
              </Button>
            </AlertDialog.Cancel>
            <Button
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
