import { Checkbox, StatusBadge, TextButton } from "@/shared/ui";
import type { ProjectTask } from "../../api/type";
import { projectShortPeriod } from "../../model/project-date.utils";
import { taskStatusLabels } from "../../model/project-labels";
import { taskRowStyles, taskRowTitleStyles } from "./task-row.variants";

const taskStatusVariants = {
  todo: "neutral",
  in_progress: "progress",
  done: "success",
  on_hold: "warning",
} as const;

interface Props {
  task: ProjectTask;
  area: string;
  assignee: string;
  pending: boolean;
  onEdit: () => void;
  onToggle: (done: boolean) => void;
}

const TaskRow = ({
  task,
  area,
  assignee,
  pending,
  onEdit,
  onToggle,
}: Props) => {
  const done = task.status === "done";
  const period = projectShortPeriod(task.starts_on, task.due_on, "마감 미정");
  const dependency = task.depends_note ? ` · 선행: ${task.depends_note}` : "";
  const description = `${area} · ${assignee} · ${period}${dependency}`;
  const status = done ? "done" : "open";

  return (
    <li className={taskRowStyles({ status })}>
      <Checkbox
        className="col-start-1 row-start-1 ml-2"
        checked={done}
        tone={done ? "muted" : "default"}
        disabled={pending}
        aria-label={`${task.title} 완료`}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <TextButton
        tone="neutral"
        size={null}
        className={taskRowTitleStyles()}
        aria-label={task.title}
        aria-describedby={`task-description-${task.id}`}
        onClick={onEdit}
      >
        <span
          data-slot="task-title"
          className="truncate leading-6 font-semibold"
        >
          {task.title}
        </span>
        <span
          id={`task-description-${task.id}`}
          data-slot="task-description"
          className="col-span-2 truncate text-caption"
        >
          {description}
        </span>
      </TextButton>
      <StatusBadge
        className="pointer-events-none z-10 col-start-3 row-start-1"
        shape="capsule"
        variant={taskStatusVariants[task.status]}
      >
        {taskStatusLabels[task.status]}
      </StatusBadge>
    </li>
  );
};

export default TaskRow;
