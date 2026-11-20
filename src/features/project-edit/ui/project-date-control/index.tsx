"use client";

import type { ComponentProps } from "react";
import { DateTimeInput } from "@/shared/ui/date-time-input";

type Props = ComponentProps<typeof DateTimeInput>["controlProps"] & {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

function ProjectDateControl({
  label,
  value,
  onChange,
  ...controlProps
}: Props) {
  const date = value ?? "";
  return (
    <DateTimeInput
      variant="field"
      label={label}
      controlProps={controlProps}
      dateOnly
      singleDate
      range={{ startDate: date, endDate: date, startTime: "", endTime: "" }}
      onConfirm={({ startDate }) => onChange(startDate || null)}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}

export default ProjectDateControl;
