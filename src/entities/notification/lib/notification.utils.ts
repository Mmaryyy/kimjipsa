import { eventRoutes } from "@/shared/config";
import type { Notification } from "../model/notification.schema";
const actions = {
  event_created: "등록되었어요.",
  event_updated: "변경되었어요.",
  event_deleted: "삭제되었어요.",
} as const;
export function notificationMessage(notification: Notification) {
  if (notification.kind === "event_reminder") {
    const { eventTitle, startTime } = notification.payload;
    const title = eventTitle ? `‘${eventTitle}’` : "일정";
    const time = startTime ? ` · ${startTime}` : "";
    return `${title}${time} 시작 전이에요.`;
  }
  if (notification.kind === "morning_summary") {
    const { count, times, projectDeadlineTitle, projectCount } =
      notification.payload;
    const lines = [];
    if (count || !projectCount) {
      lines.push(
        `오늘 일정 ${count ?? 0}개가 있어요${times?.length ? ` · ${times.join(" · ")}` : ""}`,
      );
    }
    if (projectCount) {
      const more = projectCount > 1 ? ` 외 ${projectCount - 1}건` : "";
      lines.push(`오늘 프로젝트 마감 · ${projectDeadlineTitle}${more}`);
    }
    return lines.join("\n");
  }
  if (
    notification.kind === "project_task_due" ||
    notification.kind === "project_decision_due" ||
    notification.kind === "project_reservation_due"
  ) {
    const { deadlineKind, projectDeadlineTitle, projectTitle } =
      notification.payload;
    const labels = {
      task: "할 일 마감",
      decision: "결정 기한",
      reservation_cancel: "무료 취소 마감",
      reservation_payment: "결제 마감",
    };
    const label = deadlineKind ? labels[deadlineKind] : "프로젝트 마감";
    const prefix = projectTitle ? `‘${projectTitle}’ · ` : "";
    return `${prefix}‘${projectDeadlineTitle}’ ${label}이 내일이에요.`;
  }
  const { eventTitle } = notification.payload;
  const title = eventTitle ? `‘${eventTitle}’ 일정` : "일정";
  if (notification.kind === "event_participants_changed") {
    return `${title}의 참가 인원이 변경되었어요.`;
  }
  return `${title}이 ${actions[notification.kind]}`;
}

export function notificationEventId(payload: Notification["payload"]) {
  return payload.occurrenceDate
    ? `${payload.eventId}~${payload.occurrenceDate}`
    : payload.eventId;
}

export function notificationTarget({ kind, payload }: Notification) {
  if (kind === "morning_summary")
    return payload.projectCount && !payload.count
      ? "/"
      : `${eventRoutes.calendar}?date=${payload.date}&view=day`;
  if (payload.projectId && payload.deadlineKind) {
    const section =
      payload.deadlineKind === "task"
        ? "tasks"
        : payload.deadlineKind === "decision"
          ? "decisions"
          : "reservations";
    return `/projects/${payload.projectId}/${section}`;
  }
  if (payload.eventId && kind !== "event_deleted" && !payload.eventDeleted)
    return `${eventRoutes.calendar}?event=${encodeURIComponent(notificationEventId(payload)!)}`;
}
