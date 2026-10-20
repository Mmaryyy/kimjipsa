"use client";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { fetchHolidays } from "../api/api";
import { holidayDisplayNames } from "../config/holiday-display-names.constants";

export function holidaysQueryOptions(year: number) {
  return queryOptions({
    queryKey: ["holidays", year],
    queryFn: () => fetchHolidays(year),
    staleTime: 10_800_000,
    retryOnMount: false,
  });
}

export function useHolidays(startYear: number, endYear: number) {
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );
  const queries = useQueries({
    queries: years.map(holidaysQueryOptions),
  });
  const names: Record<string, string> = {};
  for (const query of queries) {
    for (const holiday of query.data ?? []) {
      const displayName = holidayDisplayNames[holiday.name] ?? holiday.name;
      names[holiday.date] = names[holiday.date]
        ? `${names[holiday.date]} · ${displayName}`
        : displayName;
    }
  }
  const pendingYears = years.filter((_, index) => queries[index].isPending);
  return { names, isPending: pendingYears.length > 0, pendingYears };
}
