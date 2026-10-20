import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHolidays } from "../api/api";
import type { Holiday } from "../api/type";
import { useHolidays } from "./use-holidays";
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
    hook.unmount();
    const second = renderHook(() => useHolidays(2026, 2027), { wrapper });
    expect(second.result.current.names["2027-01-01"]).toBe("1월 1일");
    expect(fetchHolidays).toHaveBeenCalledTimes(2);
    second.unmount();
    client.clear();
  });
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
