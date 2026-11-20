import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { textButtonStyles } from "./ui.variants";
type TextButtonProps = ComponentProps<"button"> &
  VariantProps<typeof textButtonStyles> & { asChild?: boolean };
export function TextButton({
  asChild = false,
  tone,
  size,
  className,
  type = "button",
  ...props
}: TextButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      type={asChild ? undefined : type}
      className={cn(textButtonStyles({ tone, size }), className)}
      {...props}
    />
  );
}
