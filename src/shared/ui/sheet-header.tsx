import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { SheetProps } from "./overlay.types";
import { TextButton } from "./text-button";

export function SheetHeader({
  title,
  action,
  leadingAction,
  showCloseButton = false,
  onOpenChange,
}: Pick<
  SheetProps,
  "action" | "leadingAction" | "showCloseButton" | "onOpenChange"
> & {
  title: ReactNode;
}) {
  return (
    <header className="grid min-h-12 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2">
      <div className="justify-self-start">{leadingAction?.(onOpenChange)}</div>
      {title}
      <div className="flex items-center justify-self-end gap-3">
        {action}
        {showCloseButton && (
          <TextButton
            aria-label="닫기"
            className="size-[var(--ctl-h)] text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden className="size-5 text-[var(--icon-secondary)]" />
          </TextButton>
        )}
      </div>
    </header>
  );
}
