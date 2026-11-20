import type { ProjectMilestone, ProjectTask } from "../api/type";

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
