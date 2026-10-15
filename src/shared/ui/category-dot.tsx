import type { CSSProperties } from "react";
import { categoryColors } from "./ui.constants";
export function CategoryDot({
  color,
  label,
}: {
  color: keyof typeof categoryColors;
  label?: string;
}) {
  return (
    <span
      className="kj-category-dot"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ "--category-color": categoryColors[color] } as CSSProperties}
    />
  );
}
