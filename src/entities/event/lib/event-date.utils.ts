import { tz } from "@date-fns/tz";
import { addDays, format, startOfWeek } from "date-fns";
import { kstDate } from "./dday.utils";

// 일요일에 시작한 주의 목요일로 표시 연월과 주차를 정한다.
export function calendarWeekTitle(date: string) {
  const thursday = addDays(startOfWeek(kstDate(date), { weekStartsOn: 0 }), 4);
  const week = Math.ceil(thursday.getDate() / 7);
  return `${format(thursday, "yyyy년 M월")} ${week}주차`;
}

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
  const multipleDays = event.startDate !== event.endDate;
  const dates = `${event.startDate} ~ ${event.endDate}`;
  if (event.isAllDay) return multipleDays ? `${dates} · 종일` : "종일";
  if (event.startTime === null && event.endTime === null)
    return multipleDays ? `${dates} · 시간 미정` : "시간 미정";
  if (!multipleDays) {
    if (event.startTime === null) return `${event.endTime}까지`;
    if (event.endTime === null) return `${event.startTime}부터`;
    return `${event.startTime} ~ ${event.endTime}`;
  }
  const start = `${event.startDate}${event.startTime ? ` ${event.startTime}` : ""}`;
  const end = `${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`;
  return `${start} ~ ${end}`;
}
