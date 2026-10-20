"use client";
import { isMockDataEnabled } from "@/shared/config";
import { useEffect } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/shared/api";
import {
  fetchEvents,
  fetchEvent,
  fetchCategories,
  fetchDdayDismissals,
  dismissDdayCard,
} from "../api/api";
import { eventPollingIntervalMs } from "./event.constants";
export const eventQueryKey = ["events"] as const;
export const categoryQueryKey = ["event-categories"] as const;
export const eventsQueryOptions = queryOptions({
  queryKey: eventQueryKey,
  queryFn: fetchEvents,
  staleTime: 30_000,
  retryOnMount: false,
});
export const categoriesQueryOptions = queryOptions({
  queryKey: categoryQueryKey,
  queryFn: fetchCategories,
  staleTime: 30_000,
  retryOnMount: false,
});
export const dismissalsQueryOptions = queryOptions({
  queryKey: ["dday-dismissals"],
  queryFn: fetchDdayDismissals,
  staleTime: 30_000,
  retryOnMount: false,
});
export function useEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isMockDataEnabled()) return;
    const client = createBrowserSupabaseClient();
    const channel = client
      .channel("calendar-times")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: eventQueryKey });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          void queryClient.invalidateQueries({ queryKey: eventQueryKey });
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient]);
  // Poll as a recovery path for disconnects and category-only edits.
  return useQuery({
    ...eventsQueryOptions,
    refetchInterval: eventPollingIntervalMs,
  });
}
export function useEvent(id: string) {
  return useQuery({
    queryKey: [...eventQueryKey, id],
    queryFn: () => fetchEvent(id),
    refetchInterval: eventPollingIntervalMs,
  });
}
export function useEventCategories() {
  return useQuery({
    ...categoriesQueryOptions,
  });
}
export function useDdayDismissals() {
  return useQuery({
    ...dismissalsQueryOptions,
    refetchInterval: eventPollingIntervalMs,
  });
}
export function useDismissDdayCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissDdayCard,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dday-dismissals"] }),
  });
}
