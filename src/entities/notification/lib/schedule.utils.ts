import { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { tz } from "@date-fns/tz";

import {
  projectDeadlineKind,
  type Notification,
} from "../model/notification.schema";

const reminderKinds = {
  task: "project_task_due",
  decision: "project_decision_due",
  reservation_cancel: "project_reservation_due",
  reservation_payment: "project_reservation_due",
} as const;

export const scheduleSnapshotSchema = z.object({
  now: z.string(),
  users: z.array(
    z.object({ id: z.uuid(), familyId: z.uuid(), morningTime: z.string() }),
  ),
  deadlines: z
    .array(
      z.object({
        id: z.uuid(),
        familyId: z.uuid(),
        projectId: z.uuid(),
        kind: projectDeadlineKind,
        date: z.iso.date(),
        assigneeKind: z.enum(["unassigned", "together", "member"]).nullable(),
        assigneeId: z.uuid().nullable(),
      }),
    )
    .optional(),
  events: z.array(
    z.object({
      id: z.uuid(),
      familyId: z.uuid(),
      ownerId: z.uuid().nullable(),
      visibility: z.enum(["shared", "private"]),
      kind: z.enum(["event", "dday"]),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      startTime: z.string().nullable(),
      isAllDay: z.boolean(),
      remindBefore: z.number().nullable(),
      recurrence: z
        .enum(["daily", "weekly", "monthly", "yearly"])
        .nullable()
        .optional(),
      recurrenceUntil: z.string().nullable().optional(),
      originalDate: z.string().optional(),
      exceptions: z
        .array(
          z.object({
            originalDate: z.string(),
            cancelled: z.boolean(),
            title: z.string().nullable(),
            startDate: z.string(),
            endDate: z.string(),
            startTime: z.string().nullable(),
            isAllDay: z.boolean(),
            remindBefore: z.number().nullable(),
          }),
        )
        .optional(),
    }),
  ),
});
export type ScheduleSnapshot = z.infer<typeof scheduleSnapshotSchema>;
export type ScheduledNotification = {
  key: string;
  userId: string;
  familyId: string;
  kind:
    | "event_reminder"
    | "morning_summary"
    | (typeof reminderKinds)[keyof typeof reminderKinds];
  payload: Notification["payload"] & { date: string };
};
export const scheduleLookbackMs = 5 * 60000;
function inScheduleWindow(instant: number, now: number) {
  return instant > now - scheduleLookbackMs && instant <= now;
}
export function scheduledNotifications(
  snapshot: ScheduleSnapshot,
): ScheduledNotification[] {
  const now = new Date(snapshot.now);
  const dates = new Set([
    format(new Date(now.getTime() - scheduleLookbackMs), "yyyy-MM-dd", {
      in: tz("Asia/Seoul"),
    }),
    format(now, "yyyy-MM-dd", { in: tz("Asia/Seoul") }),
  ]);
  const notifications: ScheduledNotification[] = [];
  for (const user of snapshot.users) {
    const visible = snapshot.events.filter(
      (event) =>
        event.familyId === user.familyId &&
        (event.visibility === "shared" || event.ownerId === user.id),
    );
    for (const event of visible) {
      if (event.remindBefore === null) continue;
      const time = event.isAllDay
        ? "00:00"
        : (event.startTime?.slice(0, 5) ?? "00:00");
      const start = Date.parse(`${event.startDate}T${time}:00+09:00`);
      const due = start - event.remindBefore * 60000;
      if (inScheduleWindow(due, now.getTime()))
        notifications.push({
          key: `reminder:${user.id}:${event.id}:${event.originalDate ? `${event.originalDate}:` : ""}${start}`,
          userId: user.id,
          familyId: user.familyId,
          kind: "event_reminder",
          payload: {
            eventId: event.id,
            ...(event.originalDate && { occurrenceDate: event.originalDate }),
            date: event.startDate,
            eventTitle: event.title,
            startTime: event.isAllDay
              ? "종일"
              : (event.startTime?.slice(0, 5) ?? "시간 미정"),
          },
        });
    }
    const deadlines = (snapshot.deadlines ?? []).filter(
      (item) =>
        item.familyId === user.familyId &&
        (item.kind !== "task" ||
          item.assigneeKind === "together" ||
          (item.assigneeKind === "member" && item.assigneeId === user.id)),
    );
    for (const today of dates) {
      const todaysEvents = visible.filter(
        (event) => event.startDate <= today && event.endDate >= today,
      );
      const morningDue = Date.parse(
        `${today}T${user.morningTime.slice(0, 5)}:00+09:00`,
      );
      if (!inScheduleWindow(morningDue, now.getTime())) continue;
      const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
      for (const item of deadlines) {
        if (item.date !== tomorrow) continue;
        notifications.push({
          key: `project:${user.id}:${item.kind}:${item.id}:${item.date}`,
          userId: user.id,
          familyId: user.familyId,
          kind: reminderKinds[item.kind],
          payload: {
            date: item.date,
            projectId: item.projectId,
            projectItemId: item.id,
            deadlineKind: item.kind,
          },
        });
      }
      if (
        todaysEvents.length ||
        deadlines.some((item) => item.date === today)
      ) {
        const times = todaysEvents
          .map((event) => {
            if (event.isAllDay || event.startDate < today) return "종일";
            return event.startTime?.slice(0, 5) ?? "시간 미정";
          })
          .sort((a, b) => {
            if (a === b) return 0;
            if (a === "종일" || b === "시간 미정") return -1;
            if (b === "종일" || a === "시간 미정") return 1;
            return a.localeCompare(b);
          });
        notifications.push({
          key: `morning:${user.id}:${today}`,
          userId: user.id,
          familyId: user.familyId,
          kind: "morning_summary",
          payload: {
            date: today,
            times,
            count: times.length,
            eventIds: todaysEvents.map((event) => event.id),
            occurrences: todaysEvents
              .filter((event) => event.originalDate)
              .map((event) => ({
                eventId: event.id,
                originalDate: event.originalDate!,
              })),
          },
        });
      }
    }
  }
  return notifications;
}
