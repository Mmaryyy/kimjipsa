import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import type { StatusVariant } from "./ui.variants";
import { statusBadgeStyles } from "./ui.variants";
type StatusBadgeProps = ComponentProps<"span"> & { variant?: StatusVariant };

export function StatusBadge({
  variant = "info",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeStyles({ variant }), className)} {...props}>
      <span className="kj-status-badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
