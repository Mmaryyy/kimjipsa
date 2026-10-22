import { request } from "@/shared/api";
import { notificationsApiPath } from "@/shared/config";
import type { Notification } from "../model/notification.schema";
export function fetchNotifications() {
  return request<Notification[]>(notificationsApiPath);
}
export function markNotificationsRead(input: { id?: string }) {
  return request<null>(notificationsApiPath, input);
}
