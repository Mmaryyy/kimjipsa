import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { statusBadgeStyles, type StatusBadgeVariants } from "./ui.variants";

type StatusBadgeProps = ComponentProps<"span"> & StatusBadgeVariants;

export function StatusBadge({
  variant = "info",
  shape,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeStyles({ variant, shape }), className)}
      {...props}
    >
      <span
        className="size-1.25 flex-none rounded-[var(--r-round)] bg-[var(--status-dot)]"
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
