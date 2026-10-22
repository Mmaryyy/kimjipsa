interface LabeledOption<Value> {
  readonly value: Value;
  readonly label: string;
}

export function getOptionLabel<Value>(
  value: NoInfer<Value> | null | undefined,
  options: readonly LabeledOption<Value>[],
  defaultNotice: string,
): string;
export function getOptionLabel<Value>(
  value: NoInfer<Value> | null | undefined,
  options: readonly LabeledOption<Value>[],
  defaultNotice?: string,
): string | Value | null | undefined;
export function getOptionLabel<Value>(
  value: NoInfer<Value> | null | undefined,
  options: readonly LabeledOption<Value>[],
  defaultNotice?: string,
): string | Value | null | undefined {
  return (
    options.find((option) => option.value === value)?.label ??
    defaultNotice ??
    value
  );
}
