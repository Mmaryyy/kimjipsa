"use client";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn("kj-checkbox kj-hit", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check size={14} aria-hidden="true" className="kj-checkbox-check" />
        <Minus size={14} aria-hidden="true" className="kj-checkbox-minus" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
