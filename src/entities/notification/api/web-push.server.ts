import "server-only";
import webPush from "web-push";
import type { PushSubscription } from "web-push";
export function vapidConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT?.startsWith("mailto:")
  );
}
export async function sendWebPush(
  subscription: PushSubscription,
  payload: { id: string; body: string; url: string },
) {
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        ...payload,
        body: Array.from(payload.body).slice(0, 600).join(""),
      }),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!,
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
        TTL: 300,
        timeout: 5000,
      },
    );
    return "sent" as const;
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    // Never serialize provider errors: they contain endpoint and authorization data.
    console.error("web_push_failed", { status });
    return status === 404 || status === 410
      ? ("expired" as const)
      : ("retry" as const);
  }
}
