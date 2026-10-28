"use client";
import { useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
  useIsMutating,
  useMutationState,
  type QueryClient,
} from "@tanstack/react-query";
import {
  fetchInventory,
  fetchInventoryMeta,
  mutateInventory,
  mutateInventoryMeta,
} from "../api/api";
import type { InventoryItem } from "../api/type";
const inventoryKey = ["inventory"] as const;
const changeKey = ["inventory-change"] as const;
export const inventoryQueryOptions = queryOptions({
  queryKey: inventoryKey,
  queryFn: fetchInventory,
  staleTime: 30_000,
  retryOnMount: false,
});
export function useInventory() {
  const changing = useIsMutating({ mutationKey: changeKey }) > 0;
  return useQuery({
    ...inventoryQueryOptions,
    enabled: !changing,
    refetchInterval: changing ? false : 30_000,
  });
}
export const inventoryMetaQueryOptions = queryOptions({
  queryKey: ["inventory-meta"],
  queryFn: fetchInventoryMeta,
  networkMode: "always",
  staleTime: 30_000,
  retryOnMount: false,
});
export function useInventoryMeta() {
  return useQuery({ ...inventoryMetaQueryOptions, refetchInterval: 30_000 });
}
type Change =
  | { action: "adjust" | "used-up"; id: string; delta?: number }
  | { action: "status"; id: string; status: InventoryItem["status"] };
type PendingChange = { input: Change };
type ItemChanges = { base: InventoryItem; pending: PendingChange[] };
const journals = new WeakMap<QueryClient, Map<string, ItemChanges>>();
function applyChange(item: InventoryItem, input: Change): InventoryItem {
  if (input.action === "status") return { ...item, status: input.status };
  if (input.action === "used-up")
    return item.mode === "quantity"
      ? { ...item, quantity: 0 }
      : { ...item, status: "none" };
  return { ...item, quantity: Math.max(0, item.quantity + (input.delta ?? 0)) };
}
function publishChanges(client: QueryClient, id: string, journal: ItemChanges) {
  const updated = journal.pending.reduce(
    (item, operation) => applyChange(item, operation.input),
    journal.base,
  );
  client.setQueryData<InventoryItem[]>(inventoryKey, (items) =>
    items?.map((item) => (item.id === id ? updated : item)),
  );
}
export function useInventoryActions() {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: mutateInventory,
    onSuccess: () => client.invalidateQueries({ queryKey: inventoryKey }),
  });
  const meta = useMutation({
    mutationFn: mutateInventoryMeta,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory-meta"] }),
        client.invalidateQueries({ queryKey: inventoryKey }),
      ]);
    },
  });
  const change = useMutation({
    mutationKey: changeKey,
    // Requests are ordered while optimistic updates remain immediate for every row.
    scope: { id: "inventory-change" },
    mutationFn: (input: Change) => mutateInventory(input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: inventoryKey });
      const item = client
        .getQueryData<InventoryItem[]>(inventoryKey)
        ?.find((item) => item.id === input.id);
      if (!item) return;
      let journal = journals.get(client);
      if (!journal) {
        journal = new Map();
        journals.set(client, journal);
      }
      const changes = journal.get(input.id) ?? { base: item, pending: [] };
      const operation = { input };
      changes.pending.push(operation);
      journal.set(input.id, changes);
      publishChanges(client, input.id, changes);
      return { changes, operation };
    },
    onSettled: (_data, error, input, context) => {
      if (context) {
        const { changes, operation } = context;
        if (!error) changes.base = applyChange(changes.base, input);
        changes.pending = changes.pending.filter(
          (entry) => entry !== operation,
        );
        publishChanges(client, input.id, changes);
        if (changes.pending.length === 0)
          journals.get(client)?.delete(input.id);
      }
      if (client.isMutating({ mutationKey: changeKey }) === 1)
        return client.invalidateQueries({ queryKey: inventoryKey });
    },
  });
  const pendingIds = useMutationState({
    filters: { mutationKey: changeKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as Change).id,
  });
  const onChange = useCallback(
    (input: Change) => change.mutateAsync(input),
    [change],
  );
  return { save, meta, change, onChange, pendingIds };
}
