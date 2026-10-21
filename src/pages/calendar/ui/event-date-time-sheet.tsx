"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import { Sheet, TextButton } from "@/shared/ui";
import { WheelPicker, WheelPickerWrapper } from "@/shared/ui/wheel-picker";
import {
  dateLabel,
  dateOptions,
  hourTo12,
  hourTo24,
  initialWheelRange,
  moveEventStart,
  timeLabel,
  todayInSeoul,
  type EventDateRange,
} from "../lib/event-wheel.utils";
import {
  hourOptions,
  minuteOptions,
  periodOptions,
} from "../model/event-wheel.constants";
import { dateTimeTabStyles } from "./event-date-time-sheet.variants";

type DateTimeSheetProps = {
  range: EventDateRange;
  initialTab: "start" | "end";
  dateOnly: boolean;
  singleDate: boolean;
  onConfirm: (range: EventDateRange) => void;
  onClose: () => void;
  onRestoreFocus: () => void;
};

export function EventDateTimeSheet({
  range,
  initialTab,
  dateOnly,
  singleDate,
  onConfirm,
  onClose,
  onRestoreFocus,
}: DateTimeSheetProps) {
  const [draft, setDraft] = useState(() => initialWheelRange(range, dateOnly));
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState(initialTab);
  const date = tab === "start" ? draft.startDate : draft.endDate;
  const time = tab === "start" ? draft.startTime : draft.endTime;
  const parts = hourTo12(time || "09:00");
  const today = todayInSeoul();
  // 두 기준일 앞뒤 일 년의 합집합을 고정해 탭 전환이나 회전 중 범위가 줄지 않게 한다.
  const options = useMemo(
    () => dateOptions(range.startDate, today, range.endDate),
    [range.startDate, range.endDate, today],
  );
  const invalidRange =
    !singleDate &&
    (draft.endDate < draft.startDate ||
      (!dateOnly &&
        draft.endDate === draft.startDate &&
        draft.endTime !== "" &&
        draft.startTime !== "" &&
        draft.endTime <= draft.startTime));
  const error = invalidRange ? "종료는 시작보다 뒤여야 해요." : null;

  function onChange(date: string, time: string) {
    setDraft((current) => {
      if (tab === "end") return { ...current, endDate: date, endTime: time };
      const next = moveEventStart(current, date, time);
      return singleDate ? { ...next, endDate: date } : next;
    });
  }

  function onTimeChange(part: Partial<typeof parts>) {
    const next = { ...parts, ...part };
    onChange(date, hourTo24(next.period, next.hour, next.minute));
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="날짜와 시간 선택"
      description="시작 또는 종료를 고른 뒤 휠을 위아래로 움직여 선택해 주세요. 확인을 누르면 적용돼요."
      hideHeader
      overlayClassName="z-82"
      odId="sheet-event-date-time"
      className="z-83 rounded-t-[var(--sp-6)] overflow-hidden pt-4 md:top-auto md:bottom-0 md:translate-y-0"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        selectedTabRef.current?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
    >
      <div
        className="grid grid-cols-2 gap-4"
        role="group"
        aria-label="편집할 날짜와 시간"
      >
        {(["start", "end"] as const).map((value) => {
          if (singleDate && value === "end") return null;
          const date = value === "start" ? draft.startDate : draft.endDate;
          const time = value === "start" ? draft.startTime : draft.endTime;
          const label = value === "start" ? "시작" : "종료";
          return (
            <button
              key={value}
              type="button"
              ref={tab === value ? selectedTabRef : undefined}
              aria-label={label}
              aria-pressed={tab === value}
              data-od-id={`wheel-${value}`}
              className={dateTimeTabStyles({ selected: tab === value })}
              onClick={() => setTab(value)}
            >
              <span className="text-caption">{label}</span>
              <span className={dateOnly ? "text-headline" : "text-title"}>
                {dateOnly ? dateLabel(date) : timeLabel(time)}
              </span>
              {!dateOnly && (
                <span className="text-caption">{dateLabel(date)}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="relative my-6">
        <div
          aria-hidden
          className={cn([
            "pointer-events-none absolute top-1/2 h-[var(--ctl-h)] w-full",
            "-translate-y-1/2 rounded-sm bg-muted",
          ])}
        />
        <WheelPickerWrapper key={tab}>
          <WheelPicker
            label="날짜"
            className={dateOnly ? undefined : "flex-[2.5]"}
            options={options}
            value={date}
            onValueChange={(date) => onChange(date, time)}
          />
          {!dateOnly && (
            <>
              <WheelPicker
                label="오전/오후"
                options={periodOptions}
                value={parts.period}
                onValueChange={(period) => onTimeChange({ period })}
              />
              <WheelPicker
                label="시"
                options={hourOptions}
                infinite
                value={parts.hour}
                onValueChange={(hour) => onTimeChange({ hour })}
              />
              <WheelPicker
                label="분"
                options={minuteOptions}
                infinite
                value={parts.minute}
                onValueChange={(minute) => onTimeChange({ minute })}
              />
            </>
          )}
        </WheelPickerWrapper>
      </div>
      {error && (
        <p role="alert" className="text-caption text-error-text">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-8 pt-2">
        <TextButton data-od-id="wheel-cancel" onClick={onClose}>
          취소
        </TextButton>
        <TextButton
          data-od-id="wheel-confirm"
          disabled={Boolean(error)}
          onClick={() => onConfirm(draft)}
        >
          확인
        </TextButton>
      </div>
    </Sheet>
  );
}
