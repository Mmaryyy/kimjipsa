import type { Project, ProjectMember, ProjectTask } from "../api/type";

export const projectStatusLabels: Record<Project["status"], string> = {
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};
export const projectModuleLabels: Record<Project["modules"][number], string> = {
  decisions: "결정",
  lists: "목록 (후보·명단)",
  reservations: "예약",
  itinerary: "일정표",
  budget: "예산·지출·정산",
};
export const taskStatusLabels: Record<ProjectTask["status"], string> = {
  todo: "미시작",
  in_progress: "진행 중",
  done: "완료",
  on_hold: "보류",
};

export const taskAssignees = (members: ProjectMember[]) => [
  { value: "unassigned", label: "미정" },
  { value: "together", label: "함께" },
  ...members.map((member) => ({
    value: member.user_id,
    label: member.display_name,
  })),
];
