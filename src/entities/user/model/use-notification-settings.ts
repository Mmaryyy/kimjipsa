"use client";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchNotificationSettings,
  saveNotificationSettings,
} from "../api/notification-settings";
const notificationSettingsKey = ["notification-settings"] as const;
export const notificationSettingsQueryOptions = queryOptions({
  queryKey: notificationSettingsKey,
  queryFn: fetchNotificationSettings,
  staleTime: 30_000,
  retryOnMount: false,
});
export function useNotificationSettings() {
  return useQuery(notificationSettingsQueryOptions);
}
export function useSaveNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveNotificationSettings,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationSettingsKey }),
  });
}
