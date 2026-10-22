import "server-only";
import { nextDday } from "@/entities/event/index.server";
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
          events: snapshot.events.map((event) => {
            if (event.kind !== "dday") return event;
            const { date } = nextDday(event.startDate, new Date(snapshot.now));
            return { ...event, startDate: date, endDate: date };
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
