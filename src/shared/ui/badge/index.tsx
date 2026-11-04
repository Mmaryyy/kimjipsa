import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { badgeStyles } from "./badge.variants";

interface Props
  extends ComponentProps<"span">, VariantProps<typeof badgeStyles> {}

const Badge = ({ variant, className, ...props }: Props) => (
  <span className={cn(badgeStyles({ variant }), className)} {...props} />
);
export default Badge;
