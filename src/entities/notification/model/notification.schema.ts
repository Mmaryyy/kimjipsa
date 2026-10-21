import { z } from "zod";
export const notificationSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  family_id: z.uuid(),
  kind: z.enum(["event_created", "event_updated", "event_deleted"]),
  payload: z.object({
    eventId: z.uuid(),
    actorName: z.string(),
    eventTitle: z.string().optional(),
    eventDeleted: z.boolean().optional(),
  }),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;
export const markNotificationsSchema = z.object({ id: z.uuid().optional() });
