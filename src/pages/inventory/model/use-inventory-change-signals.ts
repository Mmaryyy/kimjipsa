"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  inventoryMetaQueryOptions,
  inventoryQueryOptions,
} from "@/entities/inventory-item";
import { useAccount } from "@/features/account";
import { createBrowserSupabaseClient } from "@/shared/api";
import { isMockDataEnabled } from "@/shared/config";

let channelRemoval: Promise<unknown> | undefined;

export function useInventoryChangeSignals() {
  const { data: account } = useAccount();
  const familyId = account?.membership?.familyId;
  const userId = account?.userId;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familyId || !userId || isMockDataEnabled()) return;

    const client = createBrowserSupabaseClient();
    let active = true;
    let channel: ReturnType<typeof client.channel> | undefined;
    const subscribe = async () => {
      // The browser client reuses the same channel until removal completes.
      await channelRemoval;
      if (!active) return;
      channel = client
        .channel(`family:${familyId}:changes`, { config: { private: true } })
        .on("broadcast", { event: "change" }, ({ payload }) => {
          if (!active) return;
          if (payload?.topic === "inventory") {
            void queryClient.invalidateQueries({
              queryKey: inventoryQueryOptions.queryKey,
            });
          } else if (payload?.topic === "inventory-meta") {
            void queryClient.invalidateQueries({
              queryKey: inventoryMetaQueryOptions.queryKey,
            });
          }
        })
        .subscribe();
    };
    const stop = () => {
      if (!active) return;
      active = false;
      if (channel) channelRemoval = client.removeChannel(channel);
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") stop();
    });
    void subscribe();

    return () => {
      subscription.unsubscribe();
      stop();
    };
  }, [familyId, userId, queryClient]);
}
