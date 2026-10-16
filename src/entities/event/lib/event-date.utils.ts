import { tz } from "@date-fns/tz";
import { format } from "date-fns";
export function eventDateInput(instant: string) {
  return format(new Date(instant), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
}
export function eventTimeLabel(event: {
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
}) {
  const dates =
    event.startDate === event.endDate
      ? event.startDate
      : `${event.startDate} ~ ${event.endDate}`;
  if (event.isAllDay) return `${dates} · 종일`;
  if (event.startTime === null && event.endTime === null) return dates;
  const start = `${event.startDate}${event.startTime ? ` ${event.startTime}` : ""}`;
  const end = `${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`;
  if (event.startDate === event.endDate) {
    if (event.startTime === null) return `${dates} · ${event.endTime}까지`;
    if (event.endTime === null) return `${dates} · ${event.startTime}부터`;
    return `${start} ~ ${event.endTime}`;
  }
  return `${start} ~ ${end}`;
}
