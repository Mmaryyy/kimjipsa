"use client";
import { useQueries } from "@tanstack/react-query";
import { fetchHolidays } from "../api/api";

export function useHolidays(startYear: number, endYear: number) {
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );
  const queries = useQueries({
    queries: years.map((year) => ({
      queryKey: ["holidays", year],
      queryFn: () => fetchHolidays(year),
      staleTime: 10800000,
    })),
  });
  const names: Record<string, string> = {};
  for (const query of queries) {
    for (const holiday of query.data ?? []) {
      names[holiday.date] = names[holiday.date]
        ? `${names[holiday.date]} · ${holiday.name}`
        : holiday.name;
    }
  }
  return { names, isPending: queries.some((query) => query.isPending) };
}
