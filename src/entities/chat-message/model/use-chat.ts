"use client";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/shared/api";
import { isMockDataEnabled } from "@/shared/config";
import {
  fetchChat,
  fetchSettings,
  saveSettings,
  writeMemory,
  cancelChat,
  applyReceipt,
  applyActions,
} from "../api/api";
export function useChat(
  familyId: string | undefined,
  visibility: "shared" | "private" = "shared",
  userId?: string | null,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["chat", familyId, visibility, userId],
    queryFn: () => fetchChat(visibility),
    enabled: !!familyId && !!userId,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (!familyId || isMockDataEnabled()) return;
    const client = createBrowserSupabaseClient();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", familyId] });
      void queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    };
    const channel = client
      .channel(`family:${familyId}:chat`, { config: { private: true } })
      .on("broadcast", { event: "*" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void client.removeChannel(channel);
        queryClient.removeQueries({ queryKey: ["chat"] });
        queryClient.removeQueries({ queryKey: ["ai-settings"] });
      } else if (session) void client.realtime.setAuth(session.access_token);
    });
    return () => {
      subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [familyId, queryClient, visibility]);
  return query;
}
export function useChatActions() {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["chat"] });
    await client.invalidateQueries({ queryKey: ["inventory"] });
    await client.invalidateQueries({ queryKey: ["events"] });
    await client.invalidateQueries({ queryKey: ["cart"] });
  };
  return {
    cancel: useMutation({ mutationFn: cancelChat, onSuccess: refresh }),
    actions: useMutation({ mutationFn: applyActions, onSuccess: refresh }),
    receipt: useMutation({ mutationFn: applyReceipt, onSuccess: refresh }),
  };
}
export function useAiSettings() {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["ai-settings"] });
    await client.invalidateQueries({ queryKey: ["chat"] });
  };
  return {
    query: useQuery({ queryKey: ["ai-settings"], queryFn: fetchSettings }),
    save: useMutation({ mutationFn: saveSettings, onSuccess: refresh }),
    memory: useMutation({ mutationFn: writeMemory, onSuccess: refresh }),
  };
}
