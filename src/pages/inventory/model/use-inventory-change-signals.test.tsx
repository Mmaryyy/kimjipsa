import type { AuthChangeEvent } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SharedApi from "@/shared/api";
import { createBrowserSupabaseClient } from "@/shared/api";
import type * as SharedConfig from "@/shared/config";
import { isMockDataEnabled } from "@/shared/config";
import { useInventoryChangeSignals } from "./use-inventory-change-signals";

const supabase = vi.hoisted(() => {
  const channel = {
    on: vi
      .fn<
        (
          type: string,
          filter: { event: string },
          receive: (message: { payload: { topic: string } }) => void,
        ) => void
      >()
      .mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const unsubscribe = vi.fn();

  return {
    channel,
    join: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    unsubscribe,
    onAuthStateChange: vi
      .fn<(listener: (event: AuthChangeEvent) => void) => unknown>()
      .mockReturnValue({ data: { subscription: { unsubscribe } } }),
  };
});

vi.mock("@/features/account", () => ({
  useAccount: () => ({
    data: { userId: "user", membership: { familyId: "family" } },
  }),
}));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  createBrowserSupabaseClient: vi.fn(() => ({
    channel: supabase.join,
    removeChannel: supabase.removeChannel,
    auth: { onAuthStateChange: supabase.onAuthStateChange },
  })),
}));
vi.mock("@/shared/config", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  isMockDataEnabled: vi.fn(),
}));

function setup() {
  const client = new QueryClient();
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    invalidateQueries,
    ...renderHook(useInventoryChangeSignals, { wrapper }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isMockDataEnabled).mockReturnValue(false);
});

describe("ADR-0024 RT1 INV-01 SCN-INV-1 재고 변경 신호", () => {
  it.each([
    ["inventory", "inventory"],
    ["inventory-meta", "inventory-meta"],
    ["unknown", null],
  ])("%s 신호에 해당하는 조회만 무효화해요", async (topic, queryKey) => {
    const { invalidateQueries } = setup();
    await waitFor(() =>
      expect(supabase.channel.subscribe).toHaveBeenCalledOnce(),
    );

    expect(supabase.join).toHaveBeenCalledWith("family:family:changes", {
      config: { private: true },
    });
    const [type, filter, receive] = supabase.channel.on.mock.calls[0];
    expect([type, filter]).toEqual(["broadcast", { event: "change" }]);
    act(() => receive({ payload: { topic } }));

    expect(invalidateQueries.mock.calls).toEqual(
      queryKey ? [[{ queryKey: [queryKey] }]] : [],
    );
  });

  it.each(["언마운트", "로그아웃"])(
    "%s 시 채널을 한 번 제거해요",
    async (reason) => {
      const { invalidateQueries, unmount } = setup();
      await waitFor(() =>
        expect(supabase.channel.subscribe).toHaveBeenCalledOnce(),
      );

      if (reason === "로그아웃") {
        const [onAuthStateChange] = supabase.onAuthStateChange.mock.calls[0];
        act(() => onAuthStateChange("SIGNED_OUT"));
        expect(supabase.removeChannel.mock.calls).toEqual([[supabase.channel]]);
      }
      unmount();

      expect(supabase.removeChannel.mock.calls).toEqual([[supabase.channel]]);
      expect(supabase.unsubscribe).toHaveBeenCalledOnce();
      const [, , receive] = supabase.channel.on.mock.calls[0];
      act(() => receive({ payload: { topic: "inventory" } }));
      expect(invalidateQueries).not.toHaveBeenCalled();
    },
  );

  it("목업 모드에서는 Supabase에 연결하지 않아요", async () => {
    vi.mocked(isMockDataEnabled).mockReturnValue(true);
    await act(async () => {
      setup();
    });

    expect(createBrowserSupabaseClient).not.toHaveBeenCalled();
  });
});
