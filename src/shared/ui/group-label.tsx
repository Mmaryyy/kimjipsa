import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

export function GroupLabel({
  as: Tag = "h2",
  className,
  ...props
}: ComponentProps<"h2"> & { as?: "h2" | "h3" | "span" }) {
  return (
    <Tag
      data-slot="group-label"
      className={cn(
        [
          "pt-5 pb-0.5 text-[length:var(--type-caption-size)] leading-[var(--type-caption-lh)]",
          "font-semibold tracking-[var(--type-caption-sm-tracking)] text-muted-foreground",
        ],
        className,
      )}
      {...props}
    />
  );
}
