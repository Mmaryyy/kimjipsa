"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/shared/lib";
import { toggleGroupStyles } from "./ui.variants";

type ToggleGroupOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};
export type ToggleGroupProps<Value extends string> = {
  label: string;
  options: readonly ToggleGroupOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
};

export function ToggleGroup<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  disabled,
  className,
  appearance,
}: ToggleGroupProps<Value> & {
  appearance: "segmented" | "filters";
}) {
  return (
    <ToggleGroupPrimitive.Root
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
