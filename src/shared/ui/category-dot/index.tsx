import type { CSSProperties } from "react";
import { resolveCategoryColor, type CategoryColor } from "@/shared/lib";
interface Props {
  color?: CategoryColor;
  cssColor?: CSSProperties["color"];
  label?: string;
}

const CategoryDot = ({ color, cssColor, label }: Props) => {
  return (
    <span
      data-slot="category-dot"
      className="size-2.5 flex-none rounded-[var(--r-round)] bg-[var(--category-color)]"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={
        {
          "--category-color": cssColor ?? resolveCategoryColor(color),
        } as CSSProperties
      }
    />
  );
};

export default CategoryDot;
