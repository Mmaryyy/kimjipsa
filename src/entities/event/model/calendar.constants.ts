export const calendarViews = [
  { value: "month", label: "월간" },
  { value: "week", label: "주간" },
  { value: "day", label: "일간" },
] as const;
export type CalendarView = (typeof calendarViews)[number]["value"];

export const calendarDdayLimit = 5;
