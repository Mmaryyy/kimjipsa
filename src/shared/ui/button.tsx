import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { buttonStyles } from "./ui.variants";

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonStyles> & { asChild?: boolean };
export function Button({
  asChild = false,
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      type={asChild ? undefined : type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
