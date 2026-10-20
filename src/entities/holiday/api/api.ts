import { request } from "@/shared/api";
import { holidaysApiPath } from "@/shared/config";
import type { Holiday } from "./type";

export function fetchHolidays(year: number) {
  return request<Holiday[]>(`${holidaysApiPath}?year=${year}`);
}
