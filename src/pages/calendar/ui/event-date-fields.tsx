"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormGetValues,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import type { EventInput } from "@/entities/event";
import { cn, useMediaQuery } from "@/shared/lib";
import { FormFieldRow } from "@/shared/ui";
import type { EventFormInput } from "../model/event-form.schema";
import {
  dateLabel,
  moveEventStart,
  timeLabel,
  todayInSeoul,
  type EventDateRange,
} from "../lib/event-wheel.utils";

const EventDateTimeSheet = dynamic(() =>
  import("./event-date-time-sheet").then((module) => module.EventDateTimeSheet),
);

type DateFieldsProps = {
  control: Control<EventFormInput, unknown, EventInput>;
  register: UseFormRegister<EventFormInput>;
  getValues: UseFormGetValues<EventFormInput>;
  setValue: UseFormSetValue<EventFormInput>;
  errors: FieldErrors<EventFormInput>;
  dateOnly: boolean;
  singleDate: boolean;
};

function EventDateField({
  prefix,
  range,
  dateOnly,
  register,
  errors,
  coarse,
  onOpen,
  onStartChange,
  open,
}: {
  prefix: "start" | "end";
  range: EventDateRange;
  dateOnly: boolean;
  register: UseFormRegister<EventFormInput>;
  errors: FieldErrors<EventFormInput>;
  coarse: boolean;
  open: boolean;
  onOpen: (button: HTMLButtonElement) => void;
  onStartChange: (date: string, time: string) => void;
}) {
  const dateField = prefix === "start" ? "startDate" : "endDate";
  const timeField = prefix === "start" ? "startTime" : "endTime";
  const label = prefix === "start" ? "시작" : "종료";
  const error = errors[dateField]?.message ?? errors[timeField]?.message;
  const dateInput = register(dateField);
  const timeInput = register(timeField);
  return (
    <FormFieldRow
      label={label}
      htmlFor={`event-${prefix}`}
      invalid={Boolean(error)}
      error={error}
    >
      {(props) =>
        coarse ? (
          <button
            {...props}
            type="button"
            data-od-id={`f-${prefix}-picker`}
            aria-label={[
              label,
              dateLabel(range[dateField]),
              !dateOnly && timeLabel(range[timeField]),
            ]
              .filter(Boolean)
              .join(", ")}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="min-h-[var(--ctl-h)] text-right text-primary [@media(pointer:coarse)]:focus-visible:outline-none"
            onClick={(event) => onOpen(event.currentTarget)}
          >
            {dateLabel(range[dateField], "yyyy. M. d.")}
            {!dateOnly && (
              <span className="ml-2">{timeLabel(range[timeField])}</span>
            )}
          </button>
        ) : (
          <div
            className={cn([
              "flex min-w-0 items-center justify-end gap-2 [&_input[type=date]]:min-w-0",
              "[&_input[type=date]]:w-32 [&_input[type=time]]:min-w-0 [&_input[type=time]]:w-22",
            ])}
          >
            <input
              {...props}
              data-od-id={`f-${prefix}-date`}
              {...dateInput}
              type="date"
              onChange={(event) => {
                if (prefix === "start" && event.target.value)
                  onStartChange(event.target.value, range.startTime);
                void dateInput.onChange(event);
              }}
            />
            {!dateOnly && (
              <input
                id={`event-${prefix}-time`}
                aria-label={`${label} 시각${prefix === "end" ? " (선택)" : ""}`}
                aria-invalid={Boolean(errors[timeField]) || undefined}
                aria-describedby={props["aria-describedby"]}
                data-od-id={`f-${prefix}-time`}
                {...timeInput}
                type="time"
                onChange={(event) => {
                  if (prefix === "start")
                    onStartChange(range.startDate, event.target.value);
                  void timeInput.onChange(event);
                }}
              />
            )}
          </div>
        )
      }
    </FormFieldRow>
  );
}

export function EventDateFields({
  control,
  register,
  getValues,
  setValue,
  errors,
  dateOnly,
  singleDate,
}: DateFieldsProps) {
  const coarse = useMediaQuery("(pointer: coarse)");
  const [session, setSession] = useState<{
    range: EventDateRange;
    tab: "start" | "end";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [startDate, endDate, startTime, endTime] = useWatch({
    control,
    name: ["startDate", "endDate", "startTime", "endTime"],
  });
  const range = { startDate, endDate, startTime, endTime };

  function applyRange(next: EventDateRange) {
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
    const next = moveEventStart(range, date, time);
    setValue("endDate", next.endDate, { shouldDirty: true });
    setValue("endTime", next.endTime, { shouldDirty: true });
  }

  return (
    <>
      {(["start", "end"] as const).map((prefix) => {
        if (singleDate && prefix === "end") return null;
        return (
          <EventDateField
            key={prefix}
            prefix={prefix}
            range={range}
            dateOnly={dateOnly}
            register={register}
            errors={errors}
            coarse={coarse}
            open={session !== null && session.tab === prefix}
            onStartChange={onStartChange}
            onOpen={(button) => {
              triggerRef.current = button;
              const values = getValues();
              setSession({
                range: {
                  startDate: values.startDate || todayInSeoul(),
                  endDate: values.endDate || values.startDate || todayInSeoul(),
                  startTime: values.startTime,
                  endTime: values.endTime,
                },
                tab: prefix,
              });
            }}
          />
        );
      })}
      {coarse && session && (
        <EventDateTimeSheet
          range={session.range}
          initialTab={session.tab}
          dateOnly={dateOnly}
          singleDate={singleDate}
          onClose={() => setSession(null)}
          onRestoreFocus={() =>
            triggerRef.current?.focus({ preventScroll: true })
          }
          onConfirm={(next) => {
            applyRange(next);
            setSession(null);
          }}
        />
      )}
    </>
  );
}
