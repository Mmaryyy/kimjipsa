import { tz } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";
import type { Todo } from "../model/todo.schema";

const seoul = tz("Asia/Seoul");

export function todoToday(instant: Date) {
  return format(instant, "yyyy-MM-dd", { in: seoul });
}

export function todoSchedule(
  todo: Pick<Todo, "due_on" | "completed_at">,
  today: string,
) {
  const due = todo.due_on;
  const referenceDate = todo.completed_at
    ? todoToday(new Date(todo.completed_at))
    : today;
  if (!due) return { date: referenceDate, overdueDays: null };
  if (due >= referenceDate) return { date: due, overdueDays: null };

  return {
    date: referenceDate,
    overdueDays:
      differenceInCalendarDays(
        `${referenceDate}T00:00:00+09:00`,
        `${due}T00:00:00+09:00`,
        { in: seoul },
      ) + 1,
  };
}
