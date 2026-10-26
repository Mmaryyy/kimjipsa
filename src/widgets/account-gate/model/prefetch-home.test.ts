import { readFileSync } from "node:fs";
import type * as ConfigModule from "@/shared/config";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useEvents,
  useEventCategories,
  useDdayDismissals,
} from "@/entities/event";
import { useInventory, useInventoryMeta } from "@/entities/inventory-item";
import { useHomeSettings } from "@/entities/user";
import { useHolidays } from "@/entities/holiday";
import { useFamily } from "@/features/family";
import { prefetchHome } from "./prefetch-home";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@/shared/config", async (original) => ({
  ...(await original<typeof ConfigModule>()),
  isMockDataEnabled: () => true,
}));

const inventoryMeta: unknown = JSON.parse(
  readFileSync("mocks/inventory-defaults.json", "utf8"),
);
const settings = { homeView: "week", upcomingEnabled: true, upcomingCount: 5 };
const family = { id: "family", name: "우리 집", members: [] };
function useHomeQueries() {
  return {
    inventory: useInventory(),
    inventoryMeta: useInventoryMeta(),
    events: useEvents(),
    categories: useEventCategories(),
    dismissals: useDdayDismissals(),
    settings: useHomeSettings(),
    family: useFamily(),
    holidays: useHolidays(2031, 2031),
  };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnMount: () => true },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

describe("ACC-12 CAL-07 P4.12 홈 쿼리 캐시", () => {
  afterEach(() => vi.unstubAllGlobals());
  it(
    "SCN-CAL-10 실제 홈 훅을 마운트해도 " +
      "미리 받은 8종을 다시 요청하지 않아요",
    async () => {
      const dataByUrl: Record<string, unknown> = {
        "/api/inventory-meta": inventoryMeta,
        "/api/account/home-settings": settings,
        "/api/family": family,
        "/api/holidays?year=2031": [
          { date: "2031-06-06", name: "망종", kind: "solarTerm" },
        ],
      };
      const fetch = vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify({ ok: true, data: dataByUrl[url] ?? [] }),
          ),
      );
      vi.stubGlobal("fetch", fetch);
      const { client, wrapper } = setup();
      await prefetchHome(client, "?date=2031-06-15");
      const calls = fetch.mock.calls.length;
      expect(calls).toBe(8);
      expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual(
        [
          "/api/inventory",
          "/api/inventory-meta",
          "/api/events",
          "/api/event-categories",
          "/api/account/home-settings",
          "/api/dday-dismissals",
          "/api/family",
          "/api/holidays?year=2031",
        ].sort(),
      );
      const { result, unmount } = renderHook(useHomeQueries, { wrapper });
      await act(async () => {});
      expect(fetch).toHaveBeenCalledTimes(calls);
      expect(result.current.inventory.data).toEqual([]);
      expect(result.current.inventoryMeta.data).toEqual(inventoryMeta);
      expect(result.current.events.data).toEqual([]);
      expect(result.current.categories.data).toEqual([]);
      expect(result.current.dismissals.data).toEqual([]);
      expect(result.current.settings.data).toEqual(settings);
      expect(result.current.family.data).toEqual(family);
      expect(result.current.holidays.isPending).toBe(false);
      expect(result.current.holidays.names).toEqual({});
      expect(result.current.holidays.specialDays).toEqual({
        "2031-06-06": [{ date: "2031-06-06", name: "망종", kind: "solarTerm" }],
      });
      unmount();
      client.clear();
    },
  );
  it(
    "SCN-CAL-10 미리 받기 실패는 마운트 " +
      "즉시 오류로 보이고 직접 재시도할 수 있어요",
    async () => {
      const fetch = vi.fn(async (): Promise<Response> => {
        throw new Error("연결 실패");
      });
      vi.stubGlobal("fetch", fetch);
      const { client, wrapper } = setup();
      await prefetchHome(client, "?date=2031-06-15");
      expect(fetch).toHaveBeenCalledTimes(8);
      const { result, unmount } = renderHook(useHomeQueries, { wrapper });
      for (const query of [
        result.current.inventory,
        result.current.inventoryMeta,
        result.current.events,
        result.current.categories,
        result.current.dismissals,
        result.current.settings,
        result.current.family,
      ]) {
        expect(query.isError).toBe(true);
        expect(query.isPending).toBe(false);
        expect(query.isFetching).toBe(false);
      }
      await act(async () => {});
      expect(fetch).toHaveBeenCalledTimes(8);
      fetch.mockImplementation(
        async () => new Response(JSON.stringify({ ok: true, data: [] })),
      );
      await act(async () => {
        await result.current.events.refetch();
      });
      await waitFor(() => expect(result.current.events.isSuccess).toBe(true));
      expect(fetch).toHaveBeenCalledTimes(9);
      unmount();
      client.clear();
    },
  );
  it("SCN-CAL-10 URL 날짜의 연말 월 그리드에 걸친 공휴일 연도도 미리 받아요", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, data: [] })),
    );
    vi.stubGlobal("fetch", fetch);
    const { client } = setup();
    await prefetchHome(client, "?date=2030-12-31");
    expect(client.getQueryData(["holidays", 2030])).toEqual([]);
    expect(client.getQueryData(["holidays", 2031])).toEqual([]);
    client.clear();
  });
});
