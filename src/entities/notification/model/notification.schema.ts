import { z } from "zod";
export const projectDeadlineKind = z.enum([
  "task",
  "decision",
  "reservation_cancel",
  "reservation_payment",
]);
export const notificationSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  family_id: z.uuid(),
  kind: z.enum([
    "event_created",
    "event_updated",
    "event_deleted",
    "event_participants_changed",
    "event_reminder",
    "morning_summary",
    "project_task_due",
    "project_decision_due",
    "project_reservation_due",
  ]),
  payload: z.object({
    eventId: z.uuid().optional(),
    occurrenceDate: z.iso.date().optional(),
    occurrences: z
      .array(z.object({ eventId: z.uuid(), originalDate: z.iso.date() }))
      .optional(),
    actorName: z.string().optional(),
    date: z.iso.date().optional(),
    times: z.array(z.string()).optional(),
    eventIds: z.array(z.uuid()).optional(),
    count: z.number().int().optional(),
    eventTitle: z.string().optional(),
    startTime: z.string().optional(),
    projectItemId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    projectTitle: z.string().optional(),
    deadlineKind: projectDeadlineKind.optional(),
    projectDeadlineTitle: z.string().optional(),
    projectCount: z.number().int().positive().optional(),
    eventDeleted: z.boolean().optional(),
  }),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;
export const markNotificationsSchema = z.object({ id: z.uuid().optional() });
