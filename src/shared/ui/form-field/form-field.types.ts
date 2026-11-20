import type { ComponentProps, ReactNode } from "react";
import type {
  ControllerRenderProps,
  FieldValues,
  Path,
  PathValue,
} from "react-hook-form";
import type QuantityStepper from "../quantity-stepper";
import type { DateTimeInput } from "../date-time-input";
import type { Select } from "../select";

type NativeProps<E extends "input" | "textarea" | typeof Select> = Omit<
  ComponentProps<E>,
  | "id"
  | "name"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "ref"
  | "type"
> & { "data-od-id"?: string };
export type FieldOption<V> = {
  value: V;
  label: string;
  disabled?: boolean;
  odId?: string;
};
export type FieldTypeProps<V> = {
  text: { inputProps?: NativeProps<"input"> };
  textarea: { inputProps?: NativeProps<"textarea"> };
  number: { inputProps?: NativeProps<"input"> };
  select: {
    options: readonly FieldOption<NonNullable<V>>[];
    noneLabel?: null extends V ? string : never;
    inputProps?: NativeProps<typeof Select>;
  };
  switch: { "data-od-id"?: string };
  segmented: {
    options: readonly FieldOption<NonNullable<V>>[];
    odId?: string;
  };
  quantity: Omit<
    ComponentProps<typeof QuantityStepper>,
    "value" | "onValueChange" | "label" | "controlProps"
  >;
  date: { pickerOdId?: string };
  datetime: Omit<
    ComponentProps<typeof DateTimeInput>,
    "label" | "controlProps" | "onConfirm"
  >;
};
export type FieldRenderProps<
  T extends FieldValues,
  N extends Path<T>,
> = ControllerRenderProps<T, N> & {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};
type CommonProps<T extends FieldValues, N extends Path<T>> = {
  name: N;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  showError?: boolean;
  errorClassName?: string;
  errorNames?: readonly Path<T>[];
};
type FieldInputValues<V> = {
  text: string;
  textarea: string;
  number: number;
  select: V;
  switch: boolean;
  segmented: NonNullable<V>;
  quantity: number;
  date: string | null;
  datetime: ComponentProps<typeof DateTimeInput>["range"];
};
type ConversionProps<V, K extends keyof FieldInputValues<V>> = {
  parse?: (value: FieldInputValues<V>[K]) => V;
  format?: (value: V) => FieldInputValues<V>[K];
};
type TypedProps<V> = {
  [K in keyof FieldTypeProps<V>]: K extends "switch"
    ? [V] extends [boolean]
      ? { type: K } & FieldTypeProps<V>[K] & ConversionProps<V, K>
      : never
    : (K extends "text" ? { type?: K } : { type: K }) &
        FieldTypeProps<V>[K] &
        ConversionProps<V, K>;
}[keyof FieldTypeProps<V>];
export type FormFieldProps<
  T extends FieldValues,
  N extends Path<T> = Path<T>,
> = { name: N } & (N extends Path<T>
  ? CommonProps<T, N> &
      (
        | (TypedProps<PathValue<T, N>> & { render?: never })
        | {
            type?: never;
            parse?: never;
            format?: never;
            render: (field: FieldRenderProps<T, N>) => ReactNode;
          }
      )
  : never);

export function defineFields<T extends FieldValues>() {
  return (rows: readonly FormFieldProps<T>[]) => rows;
}
