"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createBrowserSupabaseClient, ApiError } from "@/shared/api";
import { isMockDataEnabled } from "@/shared/config";
import { fetchCart, writeCart } from "../api/api";
import type { CartData } from "../api/type";
const cartKey = ["cart"] as const;
const mutationKey = ["cart-write"] as const;
const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
export function useCart() {
  const client = useQueryClient();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [connected, setConnected] = useState(true);
  const [syncedAt, setSyncedAt] = useState(0);
  const query = useQuery({
    queryKey: cartKey,
    queryFn: fetchCart,
    networkMode: "always",
    staleTime: 0,
    refetchInterval: () => {
      if (!online || client.isMutating({ mutationKey })) return false;
      return isMockDataEnabled() || !connected ? 1000 : 30_000;
    },
    retry: false,
  });
  const familyId = query.data?.familyId;
  useEffect(() => {
    const onOnline = () => {
      void client
        .refetchQueries({ queryKey: cartKey }, { throwOnError: true })
        .then(() => setSyncedAt(Date.now()))
        .catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [client]);
  useEffect(() => {
    if (isMockDataEnabled() || !familyId) return;
    const supabase = createBrowserSupabaseClient();
    const invalidate = () => {
      void client.invalidateQueries({
        queryKey: cartKey,
        refetchType: client.isMutating({ mutationKey }) ? "none" : "active",
      });
    };
    const channel = supabase
      .channel(`cart:${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cart_items",
          filter: `family_id=eq.${familyId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cart_items",
          filter: `family_id=eq.${familyId}`,
        },
        invalidate,
      )
      // DELETE cannot be filtered; ignore its PK-only payload and re-read through requester-scoped HTTP.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "cart_items" },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_categories",
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          void client.invalidateQueries({ queryKey: ["inventory-meta"] });
        },
      )
      .subscribe((status) => {
        const ready = status === "SUBSCRIBED";
        setConnected(ready);
        if (ready) {
          invalidate();
          void client.invalidateQueries({ queryKey: ["inventory-meta"] });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, familyId]);
  const previous = useRef<CartData | undefined>(undefined);
  const [activity, setActivity] = useState("");
  useEffect(() => {
    const data = query.data;
    if (data && previous.current?.familyId === data.familyId) {
      const checked = data.items.find(
        (item) =>
          item.is_checked &&
          item.checked_by !== data.actorId &&
          !previous.current?.items.find((old) => old.id === item.id)
            ?.is_checked,
      );
      const actor = data.members.find(
        (member) => member.user_id === checked?.checked_by,
      );
      if (checked && actor)
        setActivity(
          `방금 ${actor.display_name}님이 ${checked.name}를 담았어요`,
        );
    }
    if (data && previous.current?.networkError && !data.networkError)
      setSyncedAt(Date.now());
    previous.current = data;
  }, [query.data]);
  const offline =
    !online ||
    query.data?.networkError === true ||
    (query.error instanceof ApiError && query.error.code === "network_error");
  return { ...query, offline, syncedAt, activity };
}
export function useCartActions() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey,
    scope: { id: "cart-write" },
    mutationFn: async (command: Parameters<typeof writeCart>[0]) => {
      // Do not queue writes for replay when the browser goes offline.
      if (
        !navigator.onLine ||
        client.getQueryData<CartData>(cartKey)?.networkError
      )
        throw new ApiError(
          "offline",
          "연결이 돌아온 뒤 다시 시도해 주세요.",
          503,
        );
      return writeCart(command);
    },
    networkMode: "always",
    retry: false,
    onMutate: async (command) => {
      await client.cancelQueries({ queryKey: cartKey });
      if (
        command.action !== "check" &&
        command.action !== "delete" &&
        command.action !== "save"
      )
        return;
      const data = client.getQueryData<CartData>(cartKey);
      const item = data?.items.find((item) => item.id === command.id);
      if (!data || !item) return;
      client.setQueryData<CartData>(cartKey, {
        ...data,
        items: data.items.flatMap((row) => {
          if (row.id !== command.id) return [row];
          if (command.action === "delete") return [];
          if (command.action === "save")
            return [{ ...row, quantity: command.item.quantity }];
          return [
            {
              ...row,
              is_checked: command.checked,
              checked_by: command.checked ? data.actorId : null,
              checked_at: command.checked ? new Date().toISOString() : null,
            },
          ];
        }),
      });
      return { item, index: data.items.indexOf(item) };
    },
    onError: (error, command, context) => {
      if (error instanceof ApiError && error.code === "network_error")
        client.setQueryData<CartData>(cartKey, (data) =>
          data ? { ...data, networkError: true } : data,
        );
      if (
        !context ||
        (command.action !== "check" &&
          command.action !== "delete" &&
          command.action !== "save")
      )
        return;
      client.setQueryData<CartData>(cartKey, (data) => {
        if (!data) return data;
        const items = data.items.filter((item) => item.id !== context.item.id);
        items.splice(context.index, 0, context.item);
        return { ...data, items };
      });
    },
    onSuccess: (_result, command) => {
      if (
        command.action === "restock" ||
        command.action === "undo-restock" ||
        command.action === "order"
      ) {
        void client.invalidateQueries({ queryKey: ["inventory"] });
        void client.invalidateQueries({ queryKey: ["inventory-meta"] });
      }
    },
    onSettled: async () => {
      if (client.isMutating({ mutationKey }) === 1)
        await client.invalidateQueries({ queryKey: cartKey });
    },
  });
  const pendingIds = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) => {
      const command = mutation.state.variables as Parameters<
        typeof writeCart
      >[0];
      return "id" in command ? command.id : null;
    },
  });
  return { ...mutation, pendingIds };
}
