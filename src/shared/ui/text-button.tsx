import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { textButtonStyles } from "./ui.variants";
type TextButtonProps = ComponentProps<"button"> &
  VariantProps<typeof textButtonStyles>;
export function TextButton({
  tone,
  size,
  className,
  type = "button",
  ...props
}: TextButtonProps) {
  return (
    <button
      type={type}
      className={cn(textButtonStyles({ tone, size }), className)}
      {...props}
    />
  );
}
