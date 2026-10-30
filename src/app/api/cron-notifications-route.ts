import "server-only";
import {
  nextDday,
  expandRecurrence,
  shiftDate,
} from "@/entities/event/index.server";
import { runScheduledNotifications } from "@/entities/notification/index.server";
import { validCronSecret } from "./cron-secret.utils";
export async function cronNotificationsPOST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (
    !validCronSecret(
      request.headers.get("x-cron-secret"),
      process.env.CRON_SECRET,
    )
  )
    return Response.json(
      {
        ok: false,
        error: { code: "unauthorized", message: "인증이 필요해요." },
      },
      { status: 401, headers },
    );
  try {
    return Response.json(
      {
        ok: true,
        data: await runScheduledNotifications((snapshot) => ({
          ...snapshot,
          events: snapshot.events.flatMap((event) => {
            if (event.kind === "event" && event.recurrence) {
              const today = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(snapshot.now));
              const exceptions = (event.exceptions ?? []).map((exception) => ({
                originalDate: exception.originalDate,
                replacement: exception.cancelled
                  ? null
                  : {
                      ...event,
                      ...exception,
                      title: exception.title ?? event.title,
                    },
              }));
              return expandRecurrence(
                event,
                shiftDate(today, -1),
                shiftDate(today, 1),
                exceptions,
              );
            }
            if (event.kind !== "dday") return [event];
            const { date } = nextDday(event.startDate, new Date(snapshot.now));
            return [{ ...event, startDate: date, endDate: date }];
          }),
        })),
      },
      { headers },
    );
  } catch {
    console.error("scheduled_notifications_failed");
    return Response.json(
      {
        ok: false,
        error: {
          code: "notification_failed",
          message: "알림을 처리하지 못했어요.",
        },
      },
      { status: 500, headers },
    );
  }
}
