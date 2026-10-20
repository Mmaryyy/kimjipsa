import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHolidays } from "../api/api";
import type { Holiday } from "../api/type";
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
      { date: `${year}-01-01`, name: "1월 1일" },
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
      const holidays = [
        { date: "2026-12-25", name: "기독탄신일" },
        { date: "2026-10-09", name: "한글날" },
        { date: "2026-06-03", name: "전국동시지방선거" },
        { date: "2026-05-24", name: "부처님 오신 날" },
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
    let resolve!: (holidays: Holiday[]) => void;
    vi.mocked(fetchHolidays).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { wrapper, client } = queryWrapper();
    const hook = renderHook(() => useHolidays(2026, 2026), { wrapper });
    expect(hook.result.current.names).toEqual({});
    expect(hook.result.current.isPending).toBe(true);
    await act(async () => resolve([{ date: "2026-10-09", name: "한글날" }]));
    await waitFor(() =>
      expect(hook.result.current.names["2026-10-09"]).toBe("한글날"),
    );
    expect(hook.result.current.isPending).toBe(false);
    hook.unmount();
    client.clear();
  });
});
