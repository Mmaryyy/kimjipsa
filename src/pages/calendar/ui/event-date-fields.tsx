"use client";

import {
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import type { EventInput } from "@/entities/event";
import { FormFieldRow } from "@/shared/ui";
import {
  DateTimeInput,
  moveRangeStart,
  type DateTimeRange,
} from "@/shared/ui/date-time-input";
import type { EventFormInput } from "../model/event-form.schema";

type DateFieldsProps = {
  control: Control<EventFormInput, unknown, EventInput>;
  register: UseFormRegister<EventFormInput>;
  setValue: UseFormSetValue<EventFormInput>;
  errors: FieldErrors<EventFormInput>;
  dateOnly: boolean;
  singleDate: boolean;
};

export function EventDateFields({
  control,
  register,
  setValue,
  errors,
  dateOnly,
  singleDate,
}: DateFieldsProps) {
  const [startDate, endDate, startTime, endTime] = useWatch({
    control,
    name: ["startDate", "endDate", "startTime", "endTime"],
  });
  const range = { startDate, endDate, startTime, endTime };

  function applyRange(next: DateTimeRange) {
    for (const field of [
      "startDate",
      "endDate",
      "startTime",
      "endTime",
    ] as const) {
      setValue(field, next[field], { shouldDirty: true, shouldValidate: true });
    }
  }

  function onStartChange(date: string, time: string) {
    const next = moveRangeStart(range, date, time);
    setValue("endDate", next.endDate, { shouldDirty: true });
    setValue("endTime", next.endTime, { shouldDirty: true });
  }

  return (
    <>
      {(["start", "end"] as const).map((prefix) => {
        if (singleDate && prefix === "end") return null;
        const dateField = prefix === "start" ? "startDate" : "endDate";
        const timeField = prefix === "start" ? "startTime" : "endTime";
        const label = prefix === "start" ? "시작" : "종료";
        const error = errors[dateField]?.message ?? errors[timeField]?.message;
        const dateInput = register(dateField);
        const timeInput = register(timeField);
        return (
          <FormFieldRow
            key={prefix}
            label={label}
            htmlFor={`event-${prefix}`}
            invalid={Boolean(error)}
            error={error}
          >
            {(props) => (
              <DateTimeInput
                range={range}
                label={label}
                initialTab={prefix}
                dateOnly={dateOnly}
                singleDate={singleDate}
                controlProps={props}
                pickerOdId={`f-${prefix}-picker`}
                onConfirm={applyRange}
                dateInputProps={{
                  ...dateInput,
                  "data-od-id": `f-${prefix}-date`,
                  onChange: (event) => {
                    if (prefix === "start" && event.target.value)
                      onStartChange(event.target.value, range.startTime);
                    void dateInput.onChange(event);
                  },
                }}
                timeInputProps={{
                  ...timeInput,
                  "aria-invalid": Boolean(errors[timeField]) || undefined,
                  "data-od-id": `f-${prefix}-time`,
                  onChange: (event) => {
                    if (prefix === "start")
                      onStartChange(range.startDate, event.target.value);
                    void timeInput.onChange(event);
                  },
                }}
              />
            )}
          </FormFieldRow>
        );
      })}
    </>
  );
}
