import "server-only";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/entities/user/index.server";
import { handleRoute, readJson } from "@/shared/server";
export function notificationSettingsGET(request: Request) {
  return handleRoute(request, getNotificationSettings);
}
export function notificationSettingsPOST(request: Request) {
  return handleRoute(request, async () =>
    saveNotificationSettings(await readJson(request)),
  );
}
