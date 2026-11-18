"use client";

import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { EventInput } from "@/entities/event";
import { FormField, type FieldRenderProps } from "@/shared/ui";
import { DateTimeInput, type DateTimeRange } from "@/shared/ui/date-time-input";
import type { EventFormInput } from "../model/event-form.schema";

type DateFieldsProps = {
  control: Control<EventFormInput, unknown, EventInput>;
  setValue: UseFormSetValue<EventFormInput>;
  dateOnly: boolean;
  singleDate: boolean;
};

export function EventDateFields({
  control,
  setValue,
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

  return (
    <>
      {(["start", "end"] as const).map((prefix) => {
        if (singleDate && prefix === "end") return null;
        const dateField = prefix === "start" ? "startDate" : "endDate";
        const timeField = prefix === "start" ? "startTime" : "endTime";
        const label = prefix === "start" ? "시작" : "종료";
        return (
          <FormField<EventFormInput>
            key={prefix}
            label={label}
            name={dateField}
            errorNames={[timeField]}
            render={(
              field: FieldRenderProps<EventFormInput, "startDate" | "endDate">,
            ) => (
              <DateTimeInput
                range={range}
                label={label}
                initialTab={prefix}
                dateOnly={dateOnly}
                singleDate={singleDate}
                controlProps={field}
                pickerOdId={`f-${prefix}-picker`}
                onConfirm={applyRange}
              />
            )}
          />
        );
      })}
    </>
  );
}
