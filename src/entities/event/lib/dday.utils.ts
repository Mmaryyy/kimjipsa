import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

export function kstDate(value: string) {
  return new TZDate(`${value}T00:00:00+09:00`, "Asia/Seoul");
}
export function kstNow(instant = new Date()) {
  return new TZDate(instant, "Asia/Seoul");
}
// Keep the registered month/day: February 29 returns only in leap years.
export function ddayInYear(originalDate: string, year: number) {
  if (year < Number(originalDate.slice(0, 4))) return null;
  const candidate = `${String(year).padStart(4, "0")}${originalDate.slice(4)}`;
  return format(kstDate(candidate), "yyyy-MM-dd") === candidate
    ? candidate
    : null;
}
export function nextDday(originalDate: string, instant = new Date()) {
  const today = format(kstNow(instant), "yyyy-MM-dd");
  const firstYear = Math.max(
    Number(today.slice(0, 4)),
    Number(originalDate.slice(0, 4)),
  );
  for (let year = firstYear; year <= firstYear + 8; year++) {
    const date = ddayInYear(originalDate, year);
    if (date && date >= today) {
      const daysUntil = differenceInCalendarDays(kstDate(date), kstDate(today));
      return {
        date,
        daysUntil,
        label: daysUntil === 0 ? "D-Day" : `D-${daysUntil}`,
        anniversary: year - Number(originalDate.slice(0, 4)),
      };
    }
  }
  throw new Error("D-day 날짜를 계산하지 못했어요.");
}
