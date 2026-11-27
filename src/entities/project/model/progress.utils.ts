import type { ProjectMilestone, ProjectTask } from "../api/type";

import { projectDeadlineDays } from "./project-date.utils";

export function projectOverdue(
  tasks: readonly Pick<ProjectTask, "status" | "due_on">[],
  today: string,
) {
  let count = 0;
  let oldest = today;
  for (const { status, due_on } of tasks) {
    if (status === "done" || !due_on || due_on >= today) continue;
    count++;
    if (due_on < oldest) oldest = due_on;
  }
  return { count, oldestDays: projectDeadlineDays(today, oldest) };
}

type MilestoneStatus = "past" | "current" | "upcoming" | "tentative";

export function projectProgress(tasks: readonly Pick<ProjectTask, "status">[]) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  return { done, total, percent: total ? Math.round((100 * done) / total) : 0 };
}

export function upcomingTasks<T extends Pick<ProjectTask, "status" | "due_on">>(
  tasks: readonly T[],
  today: string,
) {
  return tasks
    .filter(
      (task) => task.status !== "done" && task.due_on && task.due_on >= today,
    )
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
}

function milestoneStatus(
  {
    starts_on,
    ends_on,
    is_tentative,
  }: Pick<ProjectMilestone, "starts_on" | "ends_on" | "is_tentative">,
  today: string,
): MilestoneStatus {
  if (is_tentative || !starts_on) return "tentative";
  if (today < starts_on) return "upcoming";
  if (today > (ends_on ?? starts_on)) return "past";
  return "current";
}

export function projectTimeline<
  T extends Pick<ProjectMilestone, "starts_on" | "ends_on" | "is_tentative">,
>(milestones: readonly T[], today: string) {
  return [...milestones]
    .sort((a, b) => {
      if (!a.starts_on) return b.starts_on ? 1 : 0;
      if (!b.starts_on) return -1;
      return a.starts_on.localeCompare(b.starts_on);
    })
    .map((milestone) => ({
      milestone,
      status: milestoneStatus(milestone, today),
    }));
}
