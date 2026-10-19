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
      className={cn(
        [
          "group/checkbox grid size-5 flex-none cursor-pointer place-items-center",
          "rounded-[var(--r-round)] border-[length:calc(var(--sp-half)*0.75)]",
          "border-[var(--sys-gray3)] data-[state=checked]:border-primary",
          "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
          "data-[state=indeterminate]:text-primary-foreground disabled:cursor-default",
          "disabled:opacity-50 kj-hit",
        ],
        className,
      )}
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
