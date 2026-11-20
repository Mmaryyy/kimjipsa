import type { Todo } from "@/entities/todo";
import { cn } from "@/shared/lib";
import { Checkbox, List, Text } from "@/shared/ui";
import {
  calendarTodoCheckboxStyles,
  calendarTodoStyles,
  calendarTodoTitleStyles,
} from "./calendar-todos.variants";

export type CalendarTodosByDate = ReadonlyMap<
  string,
  readonly { todo: Todo; overdueDays: number | null }[]
>;

export type CalendarTodoProps = {
  todosByDate?: CalendarTodosByDate;
  todoBusy?: boolean;
  onToggleTodo?: (todo: Todo, done: boolean) => void;
};

export function CalendarTodos({
  date,
  todosByDate,
  onToggleTodo,
  todoBusy,
  compact = false,
}: CalendarTodoProps & { date: string; compact?: boolean }) {
  const todos = todosByDate?.get(date);
  if (!todos?.length) return null;
  const visibleTodos = compact ? todos.slice(0, 1) : todos;
  const hiddenCount = todos.length - visibleTodos.length;
  return (
    <List data-od-id={`calendar-todos-${date}`}>
      {visibleTodos.map(({ todo, overdueDays }) => {
        const completed = !!todo.completed_at;
        const label = overdueDays
          ? `${todo.title} ${overdueDays}일째 완료`
          : `${todo.title} 완료`;
        return (
          <li key={todo.id}>
            <label className={calendarTodoStyles({ compact })}>
              <Checkbox
                checked={completed}
                disabled={todoBusy}
                className={calendarTodoCheckboxStyles({ compact })}
                aria-label={label}
                onCheckedChange={(checked) =>
                  onToggleTodo?.(todo, checked === true)
                }
              />
              <div
                className={cn(
                  "flex min-w-0 flex-1",
                  compact
                    ? "items-center gap-px"
                    : "flex-wrap items-baseline gap-x-1.5",
                )}
              >
                <Text
                  variant={compact ? "caption-xs" : "body-sm"}
                  className={calendarTodoTitleStyles({ completed, compact })}
                  title={compact ? label : undefined}
                >
                  {todo.title}
                  {compact && overdueDays && (
                    <span className="text-muted-foreground">
                      {" "}
                      {overdueDays}일째
                    </span>
                  )}
                </Text>
                {hiddenCount > 0 && (
                  <span
                    className="min-w-0 truncate text-[length:var(--sp-2)] leading-none text-muted-foreground"
                    aria-label={`할 일 ${hiddenCount}개 더 있음`}
                  >
                    +{hiddenCount}
                  </span>
                )}
                {!compact && overdueDays && (
                  <Text variant="caption-sm" className="text-muted-foreground">
                    {overdueDays}일째
                  </Text>
                )}
              </div>
            </label>
          </li>
        );
      })}
    </List>
  );
}
