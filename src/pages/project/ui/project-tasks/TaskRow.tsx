import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { taskStatusLabels, type ProjectTask } from "@/entities/project";
import { Checkbox, StatusBadge, TextButton } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { taskDeadlineStyles, taskWarningDot } from "./project-tasks.variants";

function TaskDeadline({ days }: { days: number }) {
  let label = `D-${days}`;
  let tone: "late" | "today" | "soon" | "later" = "later";
  if (days < 0) {
    label = `${-days}일 지남`;
    tone = "late";
  } else if (days === 0) {
    label = "오늘";
    tone = "today";
  } else if (days <= 7) {
    tone = "soon";
  }

  return (
    <span className={taskDeadlineStyles({ tone })}>
      {days < 0 && <span aria-hidden className={taskWarningDot} />}
      {label}
    </span>
  );
}

interface Props {
  task: ProjectTask;
  days: number | null;
  area: string;
  assignee: string;
  pending: boolean;
  onEdit: () => void;
  onToggle: (done: boolean) => void;
}

export default function TaskRow({
  task,
  days,
  area,
  assignee,
  pending,
  onEdit,
  onToggle,
}: Props) {
  const done = task.status === "done";
  const meta = [area, assignee];
  if (task.depends_note && !done) meta.push(`선행: ${task.depends_note}`);
  if (done && task.completed_at) {
    const date = format(new Date(task.completed_at), "M.d", {
      in: tz("Asia/Seoul"),
    });
    meta.push(`${date} 완료`);
  }
  const showStatus = task.status === "in_progress" || task.status === "on_hold";
  const descriptionId = `task-description-${task.id}`;
  const indicatorsId = `task-indicators-${task.id}`;
  const hasIndicators = showStatus || days !== null;

  return (
    <li className="flex items-center gap-3" data-od-id={`prj-task-${task.id}`}>
      <Checkbox
        checked={done}
        tone={done ? "muted" : "default"}
        disabled={pending}
        aria-label={`${task.title} 완료`}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <TextButton
        tone={done ? "muted" : "neutral"}
        size="touch"
        className="min-w-0 flex-1 shrink justify-start self-stretch py-2 text-left after:pointer-events-none"
        aria-label={`${task.title} 수정`}
        aria-haspopup="dialog"
        aria-describedby={
          hasIndicators ? `${descriptionId} ${indicatorsId}` : descriptionId
        }
        onClick={onEdit}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-body whitespace-normal wrap-anywhere",
                done && "text-label-done line-through",
              )}
            >
              {task.title}
            </span>
            {hasIndicators && (
              <span
                id={indicatorsId}
                className="flex shrink-0 items-center gap-2"
              >
                {showStatus && (
                  <StatusBadge
                    variant={
                      task.status === "in_progress" ? "progress" : "warning"
                    }
                  >
                    {taskStatusLabels[task.status]}
                  </StatusBadge>
                )}
                {days !== null && <TaskDeadline days={days} />}
              </span>
            )}
          </span>
          <span
            id={descriptionId}
            className={cn(
              "mt-0.5 block truncate text-caption",
              done ? "text-label-done" : "text-muted-foreground",
            )}
          >
            {meta.join(" · ")}
          </span>
        </span>
      </TextButton>
    </li>
  );
}
