import { request } from "@/shared/api";
import { holidaysApiPath } from "@/shared/config";
import type { CalendarDayInfo } from "./type";

export function fetchHolidays(year: number) {
  return request<CalendarDayInfo[]>(`${holidaysApiPath}?year=${year}`);
}
