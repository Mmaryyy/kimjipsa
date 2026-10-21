import { request } from "@/shared/api";
import { notificationSettingsApiPath } from "@/shared/config";
import type { NotificationSettings } from "../model/notification-settings.schema";
export function fetchNotificationSettings() {
  return request<NotificationSettings>(notificationSettingsApiPath);
}
export function saveNotificationSettings(settings: NotificationSettings) {
  return request<null>(notificationSettingsApiPath, settings);
}
