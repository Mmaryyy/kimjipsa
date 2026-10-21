import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHolidays } from "../api/api";
import type { CalendarDayInfo } from "../api/type";
import { holidaysQueryOptions, useHolidays } from "./use-holidays";
vi.mock("../api/api", () => ({ fetchHolidays: vi.fn() }));
function queryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
describe("CAL-17 연도별 공휴일 조회", () => {
  beforeEach(() => {
    vi.mocked(fetchHolidays).mockReset();
  });
  it("연말 범위의 두 해를 조회하고 같은 연도 캐시를 재사용해요", async () => {
    vi.mocked(fetchHolidays).mockImplementation(async (year) => [
      { date: `${year}-01-01`, name: "1월 1일", kind: "holiday" as const },
    ]);
    const { wrapper, client } = queryWrapper();
    const hook = renderHook(() => useHolidays(2026, 2027), { wrapper });
    await waitFor(() =>
      expect(Object.keys(hook.result.current.names)).toHaveLength(2),
    );
    expect(fetchHolidays).toHaveBeenCalledWith(2026);
    expect(fetchHolidays).toHaveBeenCalledWith(2027);
    expect(holidaysQueryOptions(2026).staleTime).toBe(10_800_000);
    hook.unmount();
    const second = renderHook(() => useHolidays(2026, 2027), { wrapper });
    expect(second.result.current.names["2027-01-01"]).toBe("1월 1일");
    expect(fetchHolidays).toHaveBeenCalledTimes(2);
    second.unmount();
    client.clear();
  });
  it(
    "공휴일 표시 이름만 바꾸고 " + "원본 캐시와 다른 공휴일 이름은 유지해요",
    async () => {
      const holidays: CalendarDayInfo[] = [
        { date: "2026-12-25", name: "기독탄신일", kind: "holiday" },
        { date: "2026-10-09", name: "한글날", kind: "holiday" },
        { date: "2026-06-03", name: "전국동시지방선거", kind: "holiday" },
        { date: "2026-05-24", name: "부처님 오신 날", kind: "holiday" },
      ];
      vi.mocked(fetchHolidays).mockResolvedValue(holidays);
      const { wrapper, client } = queryWrapper();
      const hook = renderHook(() => useHolidays(2026, 2026), { wrapper });
      await waitFor(() =>
        expect(hook.result.current.names).toEqual({
          "2026-12-25": "크리스마스",
          "2026-10-09": "한글날",
          "2026-06-03": "전국지방선거",
          "2026-05-24": "부처님오신날",
        }),
      );
      expect(client.getQueryData(["holidays", 2026])).toEqual(holidays);
      expect(holidays[0].name).toBe("기독탄신일");
      hook.unmount();
      client.clear();
    },
  );
  it("로딩 중에는 빈 목록이고 응답 후 이름을 보여 줘요", async () => {
    let resolve!: (holidays: CalendarDayInfo[]) => void;
    vi.mocked(fetchHolidays).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { wrapper, client } = queryWrapper();
    const hook = renderHook(() => useHolidays(2026, 2026), { wrapper });
    expect(hook.result.current.names).toEqual({});
    expect(hook.result.current.isPending).toBe(true);
    await act(async () =>
      resolve([{ date: "2026-10-09", name: "한글날", kind: "holiday" }]),
    );
    await waitFor(() =>
      expect(hook.result.current.names["2026-10-09"]).toBe("한글날"),
    );
    expect(hook.result.current.isPending).toBe(false);
    hook.unmount();
    client.clear();
  });
  it(
    "CAL-17 절기와 잡절은 휴일 색 목록에서 분리하고 " +
      "미리 받은 캐시를 재사용해요",
    async () => {
      const days: CalendarDayInfo[] = [
        { date: "2026-05-05", name: "어린이날", kind: "holiday" },
        { date: "2026-05-05", name: "입하", kind: "solarTerm" },
        { date: "2026-04-06", name: "한식", kind: "sundry" },
      ];
      vi.mocked(fetchHolidays).mockResolvedValue(days);
      const { wrapper, client } = queryWrapper();
      await client.prefetchQuery(holidaysQueryOptions(2026));
      const hook = renderHook(() => useHolidays(2026, 2026), { wrapper });
      await act(async () => {});
      expect(hook.result.current.names).toEqual({ "2026-05-05": "어린이날" });
      expect(hook.result.current.specialDays).toEqual({
        "2026-05-05": [days[1]],
        "2026-04-06": [days[2]],
      });
      expect(fetchHolidays).toHaveBeenCalledTimes(1);
      expect(client.getQueryData(["holidays", 2026])).toEqual(days);
      hook.unmount();
      client.clear();
    },
  );
});
