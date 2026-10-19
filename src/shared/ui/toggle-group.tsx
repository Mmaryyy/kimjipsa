"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { toggleGroupStyles } from "./ui.variants";

type ToggleGroupOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
  odId?: string;
};
export type ToggleGroupProps<Value extends string> = Pick<
  ComponentProps<typeof ToggleGroupPrimitive.Root>,
  "id" | "aria-invalid" | "aria-describedby"
> & {
  label: string;
  options: readonly ToggleGroupOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
  odId?: string;
};

export function ToggleGroup<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  disabled,
  className,
  appearance,
  odId,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: ToggleGroupProps<Value> & {
  appearance: "segmented" | "filters";
}) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot={
        appearance === "segmented" ? "segmented-control" : "filter-tabs"
      }
      id={id}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      data-od-id={odId}
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (!next) return;
        const option = options.find(({ value }) => value === next);
        if (option) onValueChange(option.value);
      }}
      className={cn(toggleGroupStyles({ appearance }), className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          data-od-id={option.odId}
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="kj-hit text-label"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
