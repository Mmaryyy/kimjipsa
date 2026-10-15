"use client";
import { ToggleGroup, type ToggleGroupProps } from "./toggle-group";
export function SegmentedControl<Value extends string>(
  props: ToggleGroupProps<Value>,
) {
  return <ToggleGroup appearance="segmented" {...props} />;
}
