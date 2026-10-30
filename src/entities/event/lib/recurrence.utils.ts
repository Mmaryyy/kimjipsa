import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  format,
} from "date-fns";
import { kstDate } from "./dday.utils";

export type Recurrence = "daily" | "weekly" | "monthly" | "yearly";
export type RecurringDates = {
  startDate: string;
  endDate: string;
  recurrence?: Recurrence | null;
  recurrenceUntil?: string | null;
};
export type RecurrenceException<T> = {
  originalDate: string;
  replacement: T | null;
};

export function shiftDate(date: string, days: number) {
  return format(addDays(kstDate(date), days), "yyyy-MM-dd");
}

export function isRecurrenceDate(event: RecurringDates, date: string) {
  if (
    date < event.startDate ||
    (event.recurrenceUntil && date > event.recurrenceUntil)
  )
    return false;
  const days = differenceInCalendarDays(
    kstDate(date),
    kstDate(event.startDate),
  );
  switch (event.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return days % 7 === 0;
    case "monthly":
      return date.slice(8) === event.startDate.slice(8);
    case "yearly":
      return date.slice(5) === event.startDate.slice(5);
    default:
      return date === event.startDate;
  }
}

function recurrenceCandidates(
  event: RecurringDates,
  first: string,
  end: string,
) {
  const anchor = kstDate(event.startDate);
  const lower = kstDate(first);
  const kind = event.recurrence;
  let index =
    kind === "monthly"
      ? differenceInCalendarMonths(lower, anchor)
      : kind === "yearly"
        ? differenceInCalendarYears(lower, anchor)
        : Math.floor(
            differenceInCalendarDays(lower, anchor) /
              (kind === "weekly" ? 7 : 1),
          );
  const dates: string[] = [];
  if (!kind)
    return event.startDate >= first && event.startDate <= end
      ? [event.startDate]
      : [];
  for (index = Math.max(0, index); ; index++) {
    const candidate =
      kind === "monthly"
        ? addMonths(anchor, index)
        : kind === "yearly"
          ? addYears(anchor, index)
          : addDays(anchor, index * (kind === "weekly" ? 7 : 1));
    const date = format(candidate, "yyyy-MM-dd");
    if (date > end || (event.recurrenceUntil && date > event.recurrenceUntil))
      break;
    // date-fns의 월말 보정 결과는 원래 일자가 맞을 때만 회차로 인정한다.
    if (date >= first && isRecurrenceDate(event, date)) dates.push(date);
  }
  return dates;
}

/** 원래 시작일을 기준으로 계산해 월말 보정과 회차 드리프트를 막는다. */
export function expandRecurrence<T extends RecurringDates>(
  event: T,
  start: string,
  end: string,
  exceptions: RecurrenceException<T>[] = [],
): (T & { originalDate: string })[] {
  const duration = differenceInCalendarDays(
    kstDate(event.endDate),
    kstDate(event.startDate),
  );
  const overrides = new Map(
    exceptions.map((exception) => [
      exception.originalDate,
      exception.replacement,
    ]),
  );
  const result: (T & { originalDate: string })[] = [];
  const first = [event.startDate, shiftDate(start, -duration)].sort().at(-1)!;
  for (const date of recurrenceCandidates(event, first, end)) {
    if (!isRecurrenceDate(event, date) || overrides.has(date)) continue;
    result.push({
      ...event,
      startDate: date,
      endDate: shiftDate(date, duration),
      originalDate: date,
    });
    if (!event.recurrence) break;
  }
  for (const { originalDate, replacement } of exceptions) {
    if (
      replacement &&
      isRecurrenceDate(event, originalDate) &&
      replacement.startDate <= end &&
      replacement.endDate >= start
    ) {
      result.push({ ...replacement, originalDate });
    }
  }
  return result.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.originalDate.localeCompare(b.originalDate),
  );
}

/** 첫 회차는 기존 규칙 자체를 바꾸고, 그 뒤 회차는 앞 규칙을 종료한다. */
export function splitRecurrence<T extends RecurringDates>(
  event: T,
  originalDate: string,
  replacement: T,
) {
  if (!event.recurrence || !isRecurrenceDate(event, originalDate))
    throw new Error("반복 회차를 확인해 주세요.");
  return {
    before:
      originalDate === event.startDate
        ? null
        : { ...event, recurrenceUntil: shiftDate(originalDate, -1) },
    after: replacement,
  };
}
