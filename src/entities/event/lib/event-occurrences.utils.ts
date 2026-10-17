import { differenceInCalendarDays, format } from "date-fns";
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
    Number(b.event.isAllDay) - Number(a.event.isAllDay) ||
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
          occurrences.push({
            event,
            startDate: date,
            endDate: date,
            dday: {
              date,
              daysUntil: differenceInCalendarDays(
                kstDate(date),
                kstNow(instant),
              ),
              label: "D-Day",
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
  const now = kstNow(instant);
  const today = format(now, "yyyy-MM-dd");
  const time = format(now, "HH:mm:ss");
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    if (event.kind === "dday") {
      const dday = nextDday(event.startDate, instant);
      occurrences.push({
        event,
        startDate: dday.date,
        endDate: dday.date,
        dday,
      });
      continue;
    }
    const ongoingPeriod =
      event.startDate < event.endDate &&
      event.startDate <= today &&
      event.endDate >= today &&
      (event.endDate > today ||
        event.isAllDay ||
        event.endTime === null ||
        `${event.endTime}:00` > time);
    const future =
      event.startDate > today ||
      (event.startDate === today &&
        (event.isAllDay ||
          event.startTime === null ||
          `${event.startTime}:00` >= time));
    if (ongoingPeriod || future)
      occurrences.push({
        event,
        startDate: event.startDate,
        endDate: event.endDate,
        dday: null,
      });
  }
  return occurrences.sort(compareOccurrences).slice(0, count);
}
