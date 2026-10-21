"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
} from "../api/api";
export const notificationsQueryKey = ["notifications"] as const;
export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchNotifications,
    refetchInterval: 15_000,
    retryOnMount: false,
  });
}
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...notificationsQueryKey, "unread"],
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 15_000,
    retryOnMount: false,
  });
}
