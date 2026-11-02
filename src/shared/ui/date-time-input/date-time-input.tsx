"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ComponentProps } from "react";
import { cn, useMediaQuery } from "@/shared/lib";
import {
  dateLabel,
  timeLabel,
  todayInSeoul,
  type DateTimeRange,
} from "./date-time.utils";

const DateTimeSheet = dynamic(() =>
  import("./date-time-sheet").then((module) => module.DateTimeSheet),
);

type NativeInputProps = ComponentProps<"input"> & { "data-od-id"?: string };
type DateTimeInputProps = {
  range: DateTimeRange;
  label: string;
  initialTab?: "start" | "end";
  dateOnly?: boolean;
  singleDate?: boolean;
  timeOnly?: boolean;
  controlProps: Pick<
    ComponentProps<"input">,
    "id" | "aria-invalid" | "aria-describedby"
  >;
  dateInputProps?: NativeInputProps;
  timeInputProps?: NativeInputProps;
  pickerOdId?: string;
  onConfirm: (range: DateTimeRange) => void;
};

export function DateTimeInput({
  range,
  label,
  initialTab = "start",
  dateOnly = false,
  singleDate = false,
  timeOnly = false,
  controlProps,
  dateInputProps,
  timeInputProps,
  pickerOdId,
  onConfirm,
}: DateTimeInputProps) {
  const coarse = useMediaQuery("(pointer: coarse)");
  const [session, setSession] = useState<DateTimeRange | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const date = initialTab === "start" ? range.startDate : range.endDate;
  const time = initialTab === "start" ? range.startTime : range.endTime;
  const accessibleLabel = [
    label,
    !timeOnly && dateLabel(date),
    !dateOnly && timeLabel(time),
  ]
    .filter(Boolean)
    .join(", ");

  if (!coarse) {
    return (
      <div
        className={cn(
          "flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 [&_input[type=date]]:min-w-0",
          "[&_input[type=date]]:w-32 [&_input[type=time]]:min-w-0 [&_input[type=time]]:w-35",
        )}
      >
        {!timeOnly && (
          <input {...controlProps} {...dateInputProps} type="date" />
        )}
        {!dateOnly && (
          <input
            {...controlProps}
            id={timeOnly ? controlProps.id : `${controlProps.id}-time`}
            aria-label={`${label} 시각${initialTab === "end" ? " (선택)" : ""}`}
            {...timeInputProps}
            type="time"
          />
        )}
      </div>
    );
  }
  return (
    <>
      <button
        {...controlProps}
        ref={triggerRef}
        type="button"
        data-od-id={pickerOdId}
        aria-label={accessibleLabel}
        aria-haspopup="dialog"
        aria-expanded={session !== null}
        className={cn([
          "min-h-[var(--ctl-h)] min-w-0 max-w-full text-right text-primary",
          "[@media(pointer:coarse)]:focus-visible:outline-none",
        ])}
        onClick={() =>
          setSession({
            ...range,
            startDate: range.startDate || todayInSeoul(),
            endDate: range.endDate || range.startDate || todayInSeoul(),
          })
        }
      >
        {!timeOnly && dateLabel(date, "yyyy. M. d.")}
        {!dateOnly && (
          <span className={timeOnly ? undefined : "ml-2"}>
            {timeLabel(time)}
          </span>
        )}
      </button>
      {session && (
        <DateTimeSheet
          range={session}
          initialTab={initialTab}
          dateOnly={dateOnly}
          singleDate={singleDate}
          timeOnly={timeOnly}
          onOpenChange={(open) => {
            if (!open) setSession(null);
          }}
          onRestoreFocus={() =>
            triggerRef.current?.focus({ preventScroll: true })
          }
          onConfirm={(next) => {
            onConfirm(next);
            setSession(null);
          }}
        />
      )}
    </>
  );
}
