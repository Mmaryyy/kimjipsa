"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationsRead } from "../api/api";
import type { Notification } from "./notification.schema";
export const notificationsQueryKey = ["notifications"] as const;
export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchNotifications,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
    retryOnMount: false,
  });
}
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...notificationsQueryKey, "read"],
    scope: { id: "notification-read" },
    mutationFn: markNotificationsRead,
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = client.getQueryData<Notification[]>(
        notificationsQueryKey,
      );
      const readAt = new Date().toISOString();
      client.setQueryData<Notification[]>(notificationsQueryKey, (entries) =>
        entries?.map((entry) =>
          entry.read_at === null && (!id || entry.id === id)
            ? { ...entry, read_at: readAt }
            : entry,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        client.setQueryData(notificationsQueryKey, context.previous);
    },
    onSettled: () => {
      // 이동을 재조회 완료까지 기다리게 하지 않는다.
      void client.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}
