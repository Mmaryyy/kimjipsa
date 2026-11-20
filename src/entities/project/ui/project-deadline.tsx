import { CalendarClock } from "lucide-react";
import { formatProjectDeadline } from "../model/project-date.utils";

export function ProjectDeadline({
  date,
  title,
  assignee,
}: {
  date: string;
  title: string;
  assignee?: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground">
      <CalendarClock
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <time className="shrink-0" dateTime={date}>
        {formatProjectDeadline(date)}
      </time>
      <span className="truncate font-semibold text-foreground">{title}</span>
      {assignee && (
        <span className="max-w-1/3 shrink-0 truncate text-xs">{assignee}</span>
      )}
    </span>
  );
}
