import "server-only";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/entities/notification/index.server";
import { handleRoute, readJson } from "@/shared/server";
export function notificationsGET(request: Request) {
  if (new URL(request.url).searchParams.get("unread") === "count")
    return handleRoute(request, countUnreadNotifications);
  return handleRoute(request, listNotifications);
}
export function notificationsPOST(request: Request) {
  return handleRoute(request, async () =>
    markNotificationsRead(await readJson(request)),
  );
}
