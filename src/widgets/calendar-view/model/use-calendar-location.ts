"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { z } from "zod";
import { calendarViews, kstDate, type CalendarView } from "@/entities/event";
export function useCalendarLocation(defaultView: CalendarView, today: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view =
    calendarViews.find(({ value }) => value === params?.get("view"))?.value ??
    defaultView;
  const parsedDate = z.iso.date().safeParse(params?.get("date"));
  const date = parsedDate.success ? parsedDate.data : today;
  const onNavigate = useCallback(
    (nextView: CalendarView, nextDate: string) => {
      const next = new URLSearchParams(params?.toString());
      next.set("view", nextView);
      next.set("date", nextDate);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const onViewChange = useCallback(
    (nextView: CalendarView) => onNavigate(nextView, date),
    [date, onNavigate],
  );
  const onDateChange = useCallback(
    (nextDate: string) => onNavigate(view, nextDate),
    [onNavigate, view],
  );
  const onMove = useCallback(
    (direction: number) => {
      const move = { month: addMonths, week: addWeeks, day: addDays }[view];
      onNavigate(view, format(move(kstDate(date), direction), "yyyy-MM-dd"));
    },
    [date, onNavigate, view],
  );
  return { view, date, onViewChange, onDateChange, onMove };
}
