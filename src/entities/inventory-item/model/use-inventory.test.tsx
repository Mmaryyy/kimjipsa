import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { InventoryItem } from "../api/type";
vi.mock("../api/api", () => ({
  fetchInventory: vi.fn(),
  fetchInventoryMeta: vi.fn(),
  mutateInventory: vi.fn(),
  mutateInventoryMeta: vi.fn(),
}));
import { mutateInventory, fetchInventory } from "../api/api";
import { useInventoryActions, useInventory } from "./use-inventory";
const item: InventoryItem = {
  id: crypto.randomUUID(),
  name: "우유",
  mode: "quantity",
  quantity: 2,
  status: "enough",
  unit_id: crypto.randomUUID(),
  category_id: null,
  location_id: null,
  min_quantity: 1,
  expires_on: null,
};
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(firstItem = item) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const second = { ...item, id: crypto.randomUUID(), name: "두부" };
  client.setQueryData(["inventory"], [firstItem, second]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => ({ actions: useInventoryActions(), inventory: useInventory() }),
    { wrapper },
  );
  const rows = () => client.getQueryData<InventoryItem[]>(["inventory"])!;
  return { ...hook, client, second, rows };
}
describe("INV-03 INV-15 SCN-INV-2 낙관적 수량 변경", () => {
  it("연속 입력 중 첫 요청이 실패해도 이후 입력과 다른 품목을 유지해요", async () => {
    const first = deferred();
    const next = deferred();
    const other = deferred();
    vi.mocked(mutateInventory)
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(next.promise)
      .mockReturnValueOnce(other.promise);
    const { result, rows, second, client, unmount } = setup();
    let requests!: Promise<unknown>[];
    await act(async () => {
      requests = [
        result.current.actions
          .onChange({ action: "adjust", id: item.id, delta: -1 })
          .catch(() => null),
        result.current.actions.onChange({
          action: "adjust",
          id: item.id,
          delta: 1,
        }),
        result.current.actions.onChange({
          action: "adjust",
          id: second.id,
          delta: 1,
        }),
      ];
    });
    expect(rows().map((row) => row.quantity)).toEqual([2, 3]);
    await waitFor(() =>
      expect(result.current.actions.pendingIds).toContain(second.id),
    );
    expect(result.current.inventory.isFetching).toBe(false);
    await act(async () => {
      first.reject(new Error("저장 실패"));
      await requests[0];
    });
    expect(rows().map((row) => row.quantity)).toEqual([3, 3]);
    expect(result.current.actions.pendingIds).toContain(second.id);
    await act(async () => {
      next.resolve(item.id);
      await requests[1];
    });
    expect(rows().map((row) => row.quantity)).toEqual([3, 3]);
    vi.mocked(fetchInventory).mockResolvedValue(rows());
    await act(async () => {
      other.resolve(second.id);
      await requests[2];
    });
    await waitFor(() => expect(result.current.actions.pendingIds).toEqual([]));
    expect(rows().map((row) => row.quantity)).toEqual([3, 3]);
    unmount();
    client.clear();
  });
  it("SCN-INV-3 상태 변경도 즉시 보이고 실패하면 해당 품목만 되돌려요", async () => {
    const pending = deferred();
    vi.mocked(mutateInventory).mockReset().mockReturnValueOnce(pending.promise);
    const statusItem = { ...item, mode: "status" as const, unit_id: null };
    const { result, rows, client, unmount } = setup(statusItem);
    let request!: Promise<unknown>;
    await act(async () => {
      request = result.current.actions
        .onChange({ action: "status", id: item.id, status: "none" })
        .catch(() => null);
    });
    expect(rows()[0]!.status).toBe("none");
    vi.mocked(fetchInventory).mockResolvedValue([statusItem, rows()[1]!]);
    await act(async () => {
      pending.reject(new Error("저장 실패"));
      await request;
    });
    expect(rows()[0]!.status).toBe("enough");
    unmount();
    client.clear();
  });
});
