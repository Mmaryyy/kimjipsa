"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { TextButton } from "../text-button";
import { dateTimeTriggerStyles } from "./date-time-input.variants";
import {
  dateLabel,
  timeLabel,
  todayInSeoul,
  type DateTimeRange,
} from "./date-time.utils";

const DateTimeSheet = dynamic(
  () => import("./date-time-sheet").then((module) => module.DateTimeSheet),
  { loading: () => null },
);

type DateTimeInputProps = {
  range: DateTimeRange;
  label: string;
  initialTab?: "start" | "end";
  dateOnly?: boolean;
  singleDate?: boolean;
  timeOnly?: boolean;
  controlProps: { ref?: (node: HTMLButtonElement | null) => void } & Pick<
    ComponentProps<"button">,
    "id" | "aria-invalid" | "aria-describedby" | "disabled" | "onBlur"
  >;
  pickerOdId?: string;
  onConfirm: (range: DateTimeRange) => void;
} & (
  | { variant?: "inline"; onClear?: never }
  | { variant: "field"; onClear?: () => void }
);

export function DateTimeInput({
  range,
  label,
  initialTab = "start",
  dateOnly = false,
  singleDate = false,
  timeOnly = false,
  controlProps,
  pickerOdId,
  onConfirm,
  variant = "inline",
  onClear,
}: DateTimeInputProps) {
  const triggerProps = {
    id: controlProps.id,
    "aria-invalid": controlProps["aria-invalid"],
    "aria-describedby": controlProps["aria-describedby"],
    disabled: controlProps.disabled,
    onBlur: controlProps.onBlur,
  };
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

  const trigger = (
    <button
      {...triggerProps}
      ref={(node) => {
        triggerRef.current = node;
        const ref = controlProps.ref;
        if (typeof ref === "function") ref(node);
      }}
      type="button"
      data-od-id={pickerOdId}
      aria-label={accessibleLabel}
      aria-haspopup="dialog"
      aria-expanded={session !== null}
      className={cn(dateTimeTriggerStyles({ variant, clearable: !!onClear }))}
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
        <span className={timeOnly ? undefined : "ml-2"}>{timeLabel(time)}</span>
      )}
    </button>
  );

  return (
    <>
      {variant === "field" ? (
        <div className="relative w-full min-w-0">
          {trigger}
          {onClear && (
            <TextButton
              size="icon"
              className="absolute end-0 top-0"
              aria-label={`${label} 지우기`}
              disabled={controlProps.disabled}
              onClick={() => {
                onClear();
                triggerRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden />
            </TextButton>
          )}
        </div>
      ) : (
        trigger
      )}
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
