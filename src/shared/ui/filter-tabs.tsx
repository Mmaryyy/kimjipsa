"use client";
import { ToggleGroup, type ToggleGroupProps } from "./toggle-group";
export function FilterTabs<Value extends string>(
  props: ToggleGroupProps<Value>,
) {
  return <ToggleGroup appearance="filters" {...props} />;
}
