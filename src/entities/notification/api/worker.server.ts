import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/shared/api";
import {
  getSupabaseConfig,
  eventRoutes,
  notificationsPath,
} from "@/shared/config";
import { throwDatabaseError } from "@/shared/server";
import { notificationSchema } from "../model/notification.schema";
import { pushSubscriptionSchema } from "../model/push-subscription.schema";
import {
  type ScheduleSnapshot,
  scheduleSnapshotSchema,
  scheduledNotifications,
  scheduleLookbackMs,
} from "../lib/schedule.utils";
import {
  notificationMessage,
  notificationEventId,
} from "../lib/notification.utils";
import { sendWebPush, vapidConfigured } from "./web-push.server";

function workerClient() {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("예약 알림 설정이 필요해요.");
  const { url, key } = getSupabaseConfig();
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (operation: string, input: Json = {}) => {
    const { data, error } = await client.rpc("notification_worker", {
      worker_secret: secret,
      operation,
      input,
    });
    throwDatabaseError(error);
    return data;
  };
}
export async function dispatchPendingPush() {
  if (!vapidConfigured()) return;
  const rpc = workerClient();
  const entries = z
    .array(
      notificationSchema.extend({
        subscriptions: z.array(pushSubscriptionSchema),
      }),
    )
    .parse(await rpc("claim_push"));
  await Promise.all(
    entries.map(async (entry) => {
      const eventId = entry.payload.eventId;
      const url =
        entry.kind === "morning_summary"
          ? `${eventRoutes.calendar}?date=${entry.payload.date}&view=day`
          : eventId &&
              entry.kind !== "event_deleted" &&
              !entry.payload.eventDeleted
            ? `${eventRoutes.calendar}?event=${encodeURIComponent(notificationEventId(entry.payload)!)}`
            : notificationsPath;
      const body = notificationMessage(entry);
      await Promise.all(
        entry.subscriptions.map(async (subscription) => {
          const result = await sendWebPush(subscription, {
            id: entry.id,
            body,
            url,
          });
          if (result === "expired")
            await rpc("delete_subscription", {
              userId: entry.user_id,
              endpoint: subscription.endpoint,
            });
          else if (result === "retry")
            await rpc("release_push", {
              notificationId: entry.id,
              endpoint: subscription.endpoint,
            });
        }),
      );
    }),
  );
}
export async function runScheduledNotifications(
  normalize: (snapshot: ScheduleSnapshot) => ScheduleSnapshot,
) {
  const rpc = workerClient();
  const snapshot = scheduleSnapshotSchema.parse(await rpc("snapshot"));
  const current = normalize(snapshot);
  const previous = normalize({
    ...snapshot,
    now: new Date(Date.parse(snapshot.now) - scheduleLookbackMs).toISOString(),
  });
  // Keep both annual occurrences when the recovery window crosses KST midnight.
  const events = new Map(
    [...previous.events, ...current.events].map((event) => [
      `${event.id}:${event.originalDate ?? event.startDate}`,
      event,
    ]),
  );
  const candidates = scheduledNotifications({
    ...current,
    events: [...events.values()],
  });
  for (const candidate of candidates) await rpc("schedule", candidate);
  await dispatchPendingPush();
  return { scheduled: candidates.length };
}
