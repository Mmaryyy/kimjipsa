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
    const { count, times } = notification.payload;
    return `오늘 일정 ${count ?? 0}개가 있어요${times?.length ? ` · ${times.join(" · ")}` : ""}`;
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
