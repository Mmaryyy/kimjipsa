import type { Notification } from "../model/notification.schema";
const actions = {
  event_created: "추가했어요",
  event_updated: "바꿨어요",
  event_deleted: "삭제했어요",
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
  const { actorName, eventTitle } = notification.payload;
  const title = eventTitle ? `‘${eventTitle}’` : "공유 일정";
  // Korean particles depend on the title's final syllable, not the quote.
  const last = eventTitle?.charCodeAt(eventTitle.length - 1);
  const hasFinal =
    last !== undefined &&
    last >= 0xac00 &&
    last <= 0xd7a3 &&
    (last - 0xac00) % 28 !== 0;
  const particle = !eventTitle || hasFinal ? "을" : "를";
  return `${actorName}님이 ${title}${particle} ${actions[notification.kind]}`;
}
