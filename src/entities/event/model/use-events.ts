"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/shared/api";
import { fetchEvents, fetchEvent, fetchCategories } from "../api/api";
export const eventQueryKey = ["events"] as const;
export const categoryQueryKey = ["event-categories"] as const;
export function useEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
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
    queryKey: eventQueryKey,
    queryFn: fetchEvents,
    refetchInterval: 10000,
  });
}
export function useEvent(id: string) {
  return useQuery({
    queryKey: [...eventQueryKey, id],
    queryFn: () => fetchEvent(id),
    refetchInterval: 10000,
  });
}
export function useEventCategories() {
  return useQuery({
    queryKey: categoryQueryKey,
    queryFn: fetchCategories,
    refetchInterval: 10000,
  });
}
