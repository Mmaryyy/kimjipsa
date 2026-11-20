import { tz } from "@date-fns/tz";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

const seoul = tz("Asia/Seoul");

export const projectToday = () =>
  format(new Date(), "yyyy-MM-dd", { in: seoul });

export const formatProjectDeadline = (date: string) =>
  format(parseISO(date, { in: seoul }), "M/d");

export function projectPeriod(
  start: string | null,
  end: string | null,
  unset: string,
) {
  if (start && end && start !== end)
    return `${start.replaceAll("-", ".")} – ${end.replaceAll("-", ".")}`;
  return (end ?? start)?.replaceAll("-", ".") ?? unset;
}

export const projectDeadlineDays = (date: string, today: string) =>
  differenceInCalendarDays(parseISO(date), parseISO(today));

export function projectShortPeriod(
  start: string | null,
  end: string | null,
  unset: string,
) {
  const short = (value: string) => value.slice(5).replace("-", ".");
  if (start && end && start !== end) return `${short(start)} – ${short(end)}`;
  const date = end ?? start;
  return date ? short(date) : unset;
}
