"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { z } from "zod";
import { calendarViews, kstDate, type CalendarView } from "@/entities/event";
export function useCalendarLocation(defaultView: CalendarView, today: string) {
  const params = useSearchParams();
  const pathname = usePathname();
  const urlView =
    calendarViews.find(({ value }) => value === params?.get("view"))?.value ??
    defaultView;
  const parsedDate = z.iso.date().safeParse(params?.get("date"));
  const urlDate = parsedDate.success ? parsedDate.data : today;
  const [interacted, setInteracted] = useState(false);
  const search = `${params?.get("view") ?? ""}/${params?.get("date") ?? ""}`;
  const [location, setLocation] = useState({ view: urlView, date: urlDate });
  const [previousUrl, setPreviousUrl] = useState({
    view: urlView,
    date: urlDate,
    search,
  });
  if (
    previousUrl.view !== urlView ||
    previousUrl.date !== urlDate ||
    previousUrl.search !== search
  ) {
    setPreviousUrl({ view: urlView, date: urlDate, search });
    // 늦게 도착한 기본 보기 설정은 사용자가 이미 고른 위치를 덮어쓰지 않아요.
    if (previousUrl.search !== search || !interacted) {
      setLocation({ view: urlView, date: urlDate });
    }
  }
  const { view, date } = location;
  const current = useRef(location);
  useLayoutEffect(() => {
    current.current = location;
  }, [location]);
  const onNavigate = useCallback(
    (nextView: CalendarView, nextDate: string) => {
      setInteracted(true);
      current.current = { view: nextView, date: nextDate };
      setLocation(current.current);
      const next = new URLSearchParams(params?.toString());
      next.set("view", nextView);
      next.set("date", nextDate);
      window.history.replaceState(null, "", `${pathname}?${next}`);
    },
    [params, pathname],
  );
  const onViewChange = useCallback(
    (nextView: CalendarView) => onNavigate(nextView, current.current.date),
    [onNavigate],
  );
  const onDateChange = useCallback(
    (nextDate: string) => onNavigate(current.current.view, nextDate),
    [onNavigate],
  );
  const onMove = useCallback(
    (direction: number) => {
      const { view: currentView, date: currentDate } = current.current;
      const move = { month: addMonths, week: addWeeks, day: addDays }[
        currentView
      ];
      onNavigate(
        currentView,
        format(move(kstDate(currentDate), direction), "yyyy-MM-dd"),
      );
    },
    [onNavigate],
  );
  return { view, date, onViewChange, onDateChange, onMove };
}
