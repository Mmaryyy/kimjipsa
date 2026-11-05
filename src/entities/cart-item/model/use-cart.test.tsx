import type * as SharedApi from "@/shared/api";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartData, CartWriteResult } from "../api/type";
const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  write: vi.fn(),
  status: undefined as ((status: string) => void) | undefined,
  subscriptions: [] as {
    filter: { event: string; table: string; filter?: string };
    callback: () => void;
  }[],
}));
vi.mock("../api/api", () => ({
  fetchCart: state.fetch,
  writeCart: state.write,
}));
vi.mock("@/shared/config", () => ({ isMockDataEnabled: () => false }));
vi.mock("@/shared/api", async (importOriginal) => {
  const original = await importOriginal<typeof SharedApi>();
  const channel = {
    on: (
      _event: string,
      filter: (typeof state.subscriptions)[number]["filter"],
      callback: () => void,
    ) => {
      state.subscriptions.push({ filter, callback });
      return channel;
    },
    subscribe: (callback: (status: string) => void) => {
      state.status = callback;
      return channel;
    },
  };
  return {
    ...original,
    createBrowserSupabaseClient: () => ({
      channel: () => channel,
      removeChannel: vi.fn(),
    }),
  };
});
import { useCart, useCartActions } from "./use-cart";
function fixture(): CartData {
  return {
    familyId: "family",
    actorId: "actor",
    frequent: [],
    members: [],
    items: ["first", "second"].map((id) => ({
      id,
      created_at: new Date().toISOString(),
      name: id,
      quantity: 1,
      unit_id: null,
      category_id: null,
      memo: "",
      link_url: "",
      inventory_item_id: null,
      added_by: "actor",
      is_checked: false,
      checked_by: null,
      checked_at: null,
      purchased_at: null,
    })),
  };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["cart"], fixture());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    wrapper,
    data: () => client.getQueryData<CartData>(["cart"])!,
  };
}
beforeEach(() => {
  state.fetch.mockReset().mockImplementation(async () => fixture());
  state.write.mockReset().mockResolvedValue({});
  state.subscriptions = [];
  state.status = undefined;
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
describe("CART-02 CART-14 SCN-CART-1 연결과 삭제 구독", () => {
  it("구독 중이나 Realtime 오류 때 HTTP 편집을 막지 않고 삭제는 필터 없이 다시 조회해요", async () => {
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(state.status).toBeDefined());
    act(() => state.status!("SUBSCRIBED"));
    expect(result.current.offline).toBe(false);
    act(() => state.status!("CHANNEL_ERROR"));
    expect(result.current.offline).toBe(false);
    const deletion = state.subscriptions.find(
      ({ filter }) => filter.event === "DELETE",
    )!;
    expect(deletion.filter.filter).toBeUndefined();
    state.fetch.mockClear();
    act(() => deletion.callback());
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
    const invalidate = vi.spyOn(client, "invalidateQueries");
    act(() =>
      state.subscriptions
        .find(({ filter }) => filter.table === "inventory_categories")!
        .callback(),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inventory-meta"] });
    unmount();
    client.clear();
  });
  it("SCN-CART-1 배우자의 체크 시각을 UPDATE 뒤 새로고침 없이 가져와요", async () => {
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    const updated = fixture();
    updated.items[0] = {
      ...updated.items[0]!,
      is_checked: true,
      checked_by: "partner",
      checked_at: "2026-11-05T01:00:00Z",
    };
    state.fetch.mockResolvedValue(updated);
    act(() =>
      state.subscriptions
        .find(
          ({ filter }) =>
            filter.table === "cart_items" && filter.event === "UPDATE",
        )!
        .callback(),
    );
    await waitFor(() =>
      expect(result.current.data?.items[0]).toMatchObject({
        checked_by: "partner",
        checked_at: "2026-11-05T01:00:00Z",
      }),
    );
    unmount();
    client.clear();
  });
  it("실제 오프라인에서는 마지막 목록을 유지하며 연결 복구 뒤 다시 조회해요", async () => {
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.offline).toBe(true);
    expect(result.current.data?.items).toHaveLength(2);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.syncedAt).toBeGreaterThan(0));
    expect(result.current.offline).toBe(false);
    unmount();
    client.clear();
  });
});
describe("CART-03 CART-13 SCN-CART-1 즉시 반영과 실패 복구", () => {
  it("다른 행을 계속 체크할 수 있고 한 행의 실패가 다른 행의 변경을 되돌리지 않아요", async () => {
    const { client, wrapper, data } = setup();
    let fail!: (error: Error) => void;
    let complete!: (value: CartWriteResult) => void;
    state.write
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
    const { result, unmount } = renderHook(() => useCartActions(), { wrapper });
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current
        .mutateAsync({ action: "check", id: "first", checked: true })
        .catch(() => {});
    });
    await waitFor(() => expect(data().items[0]?.is_checked).toBe(true));
    act(() => {
      second = result.current.mutateAsync({
        action: "check",
        id: "second",
        checked: true,
      });
    });
    await waitFor(() => expect(data().items[1]?.is_checked).toBe(true));
    await act(async () => {
      fail(new Error("failed"));
      await first;
    });
    expect(data().items[0]?.is_checked).toBe(false);
    expect(data().items[1]?.is_checked).toBe(true);
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    await act(async () => {
      complete({});
      await second;
    });
    unmount();
    client.clear();
  });
  it("삭제는 즉시 사라지고 실패하면 복구하며 체크에 재고 조회를 붙이지 않아요", async () => {
    const { client, wrapper, data } = setup();
    let fail!: (error: Error) => void;
    state.write.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result, unmount } = renderHook(() => useCartActions(), { wrapper });
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current
        .mutateAsync({ action: "delete", id: "first" })
        .catch(() => {});
    });
    await waitFor(() =>
      expect(data().items.map((item) => item.id)).toEqual(["second"]),
    );
    await act(async () => {
      fail(new Error("failed"));
      await pending;
    });
    expect(data().items.map((item) => item.id)).toEqual(["first", "second"]);
    await act(async () => {
      await result.current.mutateAsync({
        action: "check",
        id: "second",
        checked: true,
      });
    });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["inventory"] });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["inventory-meta"],
    });
    unmount();
    client.clear();
  });
});

describe("CART-03 수량 낙관적 갱신", () => {
  it("저장 응답 전에도 다음 수량이 보이고 실패하면 원래 수량으로 돌아와요", async () => {
    const { client, wrapper, data } = setup();
    let reject!: (error: Error) => void;
    state.write.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const { result, unmount } = renderHook(() => useCartActions(), { wrapper });
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current
        .mutateAsync({
          action: "save",
          id: "first",
          item: { ...data().items[0]!, quantity: 2 },
        })
        .catch(() => {});
    });
    await waitFor(() => expect(data().items[0]?.quantity).toBe(2));
    await act(async () => {
      reject(new Error("failed"));
      await pending;
    });
    expect(data().items[0]?.quantity).toBe(1);
    unmount();
    client.clear();
  });
});
