import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "w-full min-w-0 min-h-[var(--hit)] rounded-sm border-0 bg-muted px-3 py-2 text-foreground",
        className,
      )}
      {...props}
    />
  );
}
