import type { ReactNode } from "react";
import type { SheetProps } from "./overlay.types";

export function SheetHeader({
  title,
  action,
  leadingAction,
  onOpenChange,
}: Pick<SheetProps, "action" | "leadingAction" | "onOpenChange"> & {
  title: ReactNode;
}) {
  return (
    <header className="grid min-h-12 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2">
      <div className="justify-self-start">{leadingAction?.(onOpenChange)}</div>
      {title}
      <div className="flex items-center justify-self-end gap-3">{action}</div>
    </header>
  );
}
