"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/shared/api";
import { isMockDataEnabled } from "@/shared/config";
import { fetchTodos, writeTodo } from "../api/api";

const key = ["todos"] as const;

export function useTodos() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchTodos(signal),
    staleTime: 30_000,
    retryOnMount: false,
    refetchInterval: 30_000,
  });
  const familyId = query.data?.familyId;

  useEffect(() => {
    if (!familyId || isMockDataEnabled()) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`calendar-todos:${familyId}`);
    const refresh = () => void client.invalidateQueries({ queryKey: key });
    const filter = `family_id=eq.${familyId}`;
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "todo_changes", filter },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "todo_changes", filter },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, familyId]);

  return query;
}

export function useTodoWrite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: writeTodo,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}
