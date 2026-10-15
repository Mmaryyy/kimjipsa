import type { ComponentPropsWithoutRef } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { textStyles } from "./ui.variants";

type TextTag = "span" | "p" | "h1" | "h2" | "h3" | "h4";
type TextProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof textStyles> & { as?: TextTag };

export function Text({
  as: Tag = "span",
  variant,
  className,
  ...props
}: TextProps) {
  return <Tag className={cn(textStyles({ variant }), className)} {...props} />;
}
