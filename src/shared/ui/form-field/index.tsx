"use client";

import { useId, type ComponentType } from "react";
import {
  useController,
  useFormContext,
  type FieldValues,
  type Path,
  type RefCallBack,
} from "react-hook-form";
import { Input } from "../input";
import { Text } from "../text";
import { FormFieldRow } from "../form-field-row";
import { Switch } from "../switch";
import { SegmentedControl } from "../segmented-control";
import QuantityStepper from "../quantity-stepper";
import { DateTimeInput } from "../date-time-input";
import type { FieldTypeProps, FormFieldProps } from "./form-field.types";

export { defineFields } from "./form-field.types";
export type {
  FieldTypeProps,
  FormFieldProps,
  FieldRenderProps,
} from "./form-field.types";

type ControlProps = {
  id: string;
  name: string;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  ref: RefCallBack;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};
type Registry = {
  [K in keyof FieldTypeProps<unknown>]: ComponentType<{
    field: ControlProps;
    label: string;
    props: FieldTypeProps<unknown>[K];
  }>;
};
const registry: Registry = {
  text: ({ props, field: { value, onChange, ...field } }) => (
    <input
      {...props.inputProps}
      {...field}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  textarea: ({ props, field: { value, onChange, ...field } }) => (
    <textarea
      {...props.inputProps}
      {...field}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  number: ({ props, field: { value, onChange, ...field } }) => (
    <Input
      {...props.inputProps}
      {...field}
      type="number"
      value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
      onChange={(event) => onChange(event.target.valueAsNumber)}
    />
  ),
  select: ({
    props: { options, noneLabel, inputProps },
    field: { value, onChange, ...field },
  }) => {
    let noneValue = "none";
    while (options.some((option) => String(option.value) === noneValue))
      noneValue = `_${noneValue}`;
    return (
      <select
        {...inputProps}
        {...field}
        value={value == null ? noneValue : String(value)}
        onChange={(event) => {
          if (noneLabel !== undefined && event.target.value === noneValue)
            onChange(null);
          else {
            const option = options.find(
              (option) => String(option.value) === event.target.value,
            );
            if (option && !option.disabled) onChange(option.value);
          }
        }}
      >
        {noneLabel !== undefined && (
          <option value={noneValue}>{noneLabel}</option>
        )}
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  },
  switch: ({ props, field: { value, onChange, ...field } }) => (
    <Switch
      {...field}
      data-od-id={props["data-od-id"]}
      checked={value === true}
      onCheckedChange={onChange}
    />
  ),
  segmented: ({ props, label, field }) => (
    <div
      ref={(node) => field.ref(node?.querySelector("button"))}
      onBlur={field.onBlur}
    >
      <SegmentedControl
        id={field.id}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        disabled={field.disabled}
        odId={props.odId}
        label={label}
        value={String(field.value)}
        options={props.options.map((option) => ({
          ...option,
          value: String(option.value),
        }))}
        onValueChange={(next) => {
          const option = props.options.find(
            (option) => String(option.value) === next,
          );
          if (option) field.onChange(option.value);
        }}
      />
    </div>
  ),
  quantity: ({ props, label, field }) => (
    <QuantityStepper
      label={label}
      min={props.min}
      max={props.max}
      step={props.step}
      unit={props.unit}
      allowDirectInput={props.allowDirectInput}
      collapsible={props.collapsible}
      disabled={field.disabled}
      value={Number(field.value)}
      onValueChange={field.onChange}
      controlProps={field}
    />
  ),
  date: ({ props, label, field }) => (
    <DateTimeInput
      controlProps={field}
      label={label}
      pickerOdId={props.pickerOdId}
      dateOnly
      singleDate
      range={{
        startDate: String(field.value ?? ""),
        endDate: String(field.value ?? ""),
        startTime: "",
        endTime: "",
      }}
      onConfirm={(next) => {
        field.onChange(next.startDate || null);
        field.onBlur();
      }}
    />
  ),
  datetime: ({ props, label, field }) => (
    <DateTimeInput
      controlProps={field}
      label={label}
      range={props.range}
      initialTab={props.initialTab}
      dateOnly={props.dateOnly}
      singleDate={props.singleDate}
      timeOnly={props.timeOnly}
      pickerOdId={props.pickerOdId}
      onConfirm={(next) => {
        field.onChange(next);
        field.onBlur();
      }}
    />
  ),
};

export function FormField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: FormFieldProps<T, N>,
) {
  const form = useFormContext<T>();
  const { field, formState } = useController<T, N>({
    name: props.name,
    control: form.control,
  });
  const id = useId();
  const error = [props.name, ...(props.errorNames ?? [])]
    .map((name) => form.getFieldState(name, formState).error?.message)
    .find(Boolean);
  const controlProps = {
    ...field,
    id,
    disabled: props.disabled ?? field.disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [error && `${id}-error`, props.hint && `${id}-hint`]
        .filter(Boolean)
        .join(" ") || undefined,
  } as const;
  const value = props.format ? props.format(field.value) : field.value;
  const onChange = (next: unknown) => {
    field.onChange(props.parse ? props.parse(next as never) : next);
  };
  const typedField = { ...controlProps, value, onChange };
  // TS는 동적 registry 조회에서 type과 해당 props 맵의 관계를 잃어요.
  const Component = registry[props.type ?? "text"] as ComponentType<{
    field: ControlProps;
    label: string;
    props: typeof props;
  }>;
  const input = props.render ? (
    props.render(controlProps)
  ) : (
    <Component field={typedField} label={props.label} props={props} />
  );
  return (
    <>
      <FormFieldRow
        label={props.label}
        htmlFor={id}
        invalid={!!error}
        error={props.showError === false ? undefined : error}
        showLabel={props.showLabel}
        errorClassName={props.errorClassName}
        className={props.className}
      >
        {() => input}
      </FormFieldRow>
      {props.hint && (
        <Text
          as="p"
          variant="caption"
          id={`${id}-hint`}
          className="text-muted-foreground"
        >
          {props.hint}
        </Text>
      )}
    </>
  );
}
