import "server-only";
import {
  listNotifications,
  markNotificationsRead,
} from "@/entities/notification/index.server";
import { handleRoute, readJson } from "@/shared/server";
export function notificationsGET(request: Request) {
  return handleRoute(request, listNotifications);
}
export function notificationsPOST(request: Request) {
  return handleRoute(request, async () =>
    markNotificationsRead(await readJson(request)),
  );
}
