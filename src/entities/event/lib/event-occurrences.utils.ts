import { addDays, differenceInCalendarDays, format } from "date-fns";
import type { CalendarEvent } from "../api/type";
import { ddayInYear, kstDate, kstNow, nextDday } from "./dday.utils";
export type EventOccurrence = {
  event: CalendarEvent;
  startDate: string;
  endDate: string;
  dday: ReturnType<typeof nextDday> | null;
};
export function compareOccurrences(a: EventOccurrence, b: EventOccurrence) {
  return (
    a.startDate.localeCompare(b.startDate) ||
    Number(b.startDate > b.event.startDate || b.event.isAllDay) -
      Number(a.startDate > a.event.startDate || a.event.isAllDay) ||
    (a.event.startTime ?? "99:99").localeCompare(
      b.event.startTime ?? "99:99",
    ) ||
    (a.event.endTime ?? "99:99").localeCompare(b.event.endTime ?? "99:99") ||
    a.event.id.localeCompare(b.event.id)
  );
}
export function occurrencesInRange(
  events: CalendarEvent[],
  start: string,
  end: string,
  instant = new Date(),
) {
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    if (event.kind === "dday") {
      for (
        let year = Number(start.slice(0, 4));
        year <= Number(end.slice(0, 4));
        year++
      ) {
        const date = ddayInYear(event.startDate, year);
        if (date && date >= start && date <= end) {
          const daysUntil = differenceInCalendarDays(
            kstDate(date),
            kstNow(instant),
          );
          occurrences.push({
            event,
            startDate: date,
            endDate: date,
            dday: {
              date,
              daysUntil,
              label:
                daysUntil === 0
                  ? "D-Day"
                  : daysUntil > 0
                    ? `D-${daysUntil}`
                    : `D+${-daysUntil}`,
              anniversary: year - Number(event.startDate.slice(0, 4)),
            },
          });
        }
      }
    } else if (event.startDate <= end && event.endDate >= start) {
      occurrences.push({
        event,
        startDate: event.startDate,
        endDate: event.endDate,
        dday: null,
      });
    }
  }
  return occurrences.sort(compareOccurrences);
}
export function upcomingOccurrences(
  events: CalendarEvent[],
  count: number,
  instant = new Date(),
) {
  const tomorrow = format(addDays(kstNow(instant), 1), "yyyy-MM-dd");
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    if (event.kind === "dday") {
      const dday = nextDday(event.startDate, instant);
      if (dday.date < tomorrow) continue;
      occurrences.push({
        event,
        startDate: dday.date,
        endDate: dday.date,
        dday,
      });
      continue;
    }
    if (event.endDate >= tomorrow)
      occurrences.push({
        event,
        startDate: event.startDate < tomorrow ? tomorrow : event.startDate,
        endDate: event.endDate,
        dday: null,
      });
  }
  return occurrences.sort(compareOccurrences).slice(0, count);
}

/** D-day 섹션은 오늘을 포함한 다음 기념일만 계산한다. 위젯의 시작일 규칙과 독립적이다. */
export function ddayOccurrences(
  events: CalendarEvent[],
  count: number,
  instant = new Date(),
) {
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    if (event.kind !== "dday" || event.details === null) continue;
    const dday = nextDday(event.startDate, instant);
    occurrences.push({ event, startDate: dday.date, endDate: dday.date, dday });
  }
  return occurrences.sort(compareOccurrences).slice(0, count);
}
