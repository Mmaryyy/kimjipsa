"use client";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { checkboxStyles } from "./ui.variants";

export function Checkbox({
  className,
  tone,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> &
  VariantProps<typeof checkboxStyles>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(checkboxStyles({ tone }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check
          size={14}
          aria-hidden="true"
          className="group-data-[state=indeterminate]/checkbox:hidden"
        />
        <Minus
          size={14}
          aria-hidden="true"
          className="hidden group-data-[state=indeterminate]/checkbox:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
