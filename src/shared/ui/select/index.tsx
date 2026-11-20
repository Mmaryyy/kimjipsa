import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib";
import { selectContainerStyles, selectStyles } from "../ui.variants";

type SelectProps = ComponentProps<"select"> &
  VariantProps<typeof selectStyles> & { controlClassName?: string };

export function Select({
  className,
  controlClassName,
  variant,
  ...props
}: SelectProps) {
  return (
    <span
      className={cn(
        selectContainerStyles({ inline: variant === "inline" }),
        className,
      )}
    >
      <select
        {...props}
        className={cn(selectStyles({ variant }), controlClassName)}
      />
      <ChevronDown size={16} aria-hidden />
    </span>
  );
}
