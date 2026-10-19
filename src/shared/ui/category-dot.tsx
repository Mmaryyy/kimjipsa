import type { CSSProperties } from "react";
import { categoryColors } from "./ui.constants";
export function CategoryDot({
  color,
  label,
}: {
  color?: keyof typeof categoryColors;
  label?: string;
}) {
  return (
    <span
      data-slot="category-dot"
      className="size-2.5 flex-none rounded-[var(--r-round)] bg-[var(--category-color)]"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={
        {
          "--category-color": color ? categoryColors[color] : "var(--sys-teal)",
        } as CSSProperties
      }
    />
  );
}
