import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Next 데이터 캐시 경계: 성공만 저장하고 재검증 실패는 이전 값을 유지해요.
const { cacheEntries, cacheOptions } = vi.hoisted(() => ({
  cacheEntries: new Map<string, { value: unknown; expires: number }>(),
  cacheOptions: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (
    callback: (year: number) => Promise<unknown>,
    keys: string[],
    options: { revalidate: number },
  ) => {
    cacheOptions(keys, options);
    return async (year: number) => {
      const key = JSON.stringify([...keys, year]);
      const previous = cacheEntries.get(key);
      if (previous && previous.expires > Date.now()) return previous.value;
      try {
        const value = await callback(year);
        cacheEntries.set(key, {
          value,
          expires: Date.now() + options.revalidate * 1000,
        });
        return value;
      } catch (error) {
        if (previous) return previous.value;
        throw error;
      }
    };
  },
}));
vi.mock("@/shared/server", () => ({ mockContext: vi.fn(), mockJson: vi.fn() }));
import { mockContext, mockJson } from "@/shared/server";
import { fetchPublicHolidays, listHolidays, parseHolidays } from "./server";

// 모듈 초기화 때의 설정은 테스트 사이 mock 호출 기록 초기화와 분리해요.
const initialCacheOptions = cacheOptions.mock.calls.map((args) => [...args]);

const item = { locdate: 20261003, dateName: "개천절", isHoliday: "Y" };
function payload(items: unknown, totalCount = 1) {
  return {
    response: { header: { resultCode: "00" }, body: { items, totalCount } },
  };
}
let clock = Date.now();
describe("CAL-17 특일정보 조회", () => {
  beforeEach(() => {
    clock += 10 * 60 * 1000;
    vi.useFakeTimers();
    vi.setSystemTime(clock);
    cacheEntries.clear();
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(mockContext).mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("공휴일만 날짜와 이름으로 반환하고 단건 객체도 처리해요", () => {
    expect(parseHolidays(payload({ item }), 2026)).toEqual([
      { date: "2026-10-03", name: "개천절" },
    ]);
    expect(
      parseHolidays(
        payload({ item: [item, { ...item, isHoliday: "N" }] }, 2),
        2026,
      ),
    ).toEqual([{ date: "2026-10-03", name: "개천절" }]);
    expect(parseHolidays(payload("", 0), 2026)).toEqual([]);
  });
  it("키가 없으면 외부 호출 없이 빈 목록이에요", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "");
    expect(await fetchPublicHolidays(2026)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("검증한 연 단위 목록만 3시간 캐시하고 원문은 저장하지 않아요", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload({ item })));
    expect(await fetchPublicHolidays(2026)).toHaveLength(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("getRestDeInfo");
    expect(new URL(String(url)).searchParams.get("solYear")).toBe("2026");
    expect(new URL(String(url)).searchParams.get("_type")).toBe("json");
    expect(new URL(String(url)).searchParams.has("solMonth")).toBe(false);
    expect(options).toMatchObject({ cache: "no-store" });
    expect(initialCacheOptions).toContainEqual([
      ["holidays"],
      { revalidate: 10800 },
    ]);
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "another-key");
    expect(await fetchPublicHolidays(2026)).toEqual([
      { date: "2026-10-03", name: "개천절" },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...cacheEntries.keys()]).toEqual(['["holidays",2026]']);
  });
  it.each([
    "network",
    "http",
    "json",
    "xml",
    "timeout",
    "schema",
    "invalid-date",
    "wrong-year",
    "incomplete",
  ])("%s 실패는 빈 목록으로 돌아와요", async (failure) => {
    const responses: Record<string, Response> = {
      http: new Response(null, { status: 503 }),
      json: new Response("not json"),
      xml: new Response(
        "<OpenAPI_ServiceResponse><cmmMsgHeader>LIMIT</cmmMsgHeader></OpenAPI_ServiceResponse>",
      ),
      schema: Response.json({ response: { header: { resultCode: "30" } } }),
      "invalid-date": Response.json(
        payload({ item: { ...item, locdate: 20260230 } }),
      ),
      "wrong-year": Response.json(
        payload({ item: { ...item, locdate: 20271003 } }),
      ),
      incomplete: Response.json(payload({ item }, 2)),
    };
    if (failure === "timeout")
      vi.mocked(fetch).mockRejectedValue(
        new DOMException("secret-url", "TimeoutError"),
      );
    else if (failure === "network")
      vi.mocked(fetch).mockRejectedValue(new Error("secret-url"));
    else vi.mocked(fetch).mockResolvedValue(responses[failure]);
    expect(await fetchPublicHolidays(2026)).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
    expect(cacheEntries.size).toBe(0);
    expect(await fetchPublicHolidays(2026)).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000);
    vi.mocked(fetch).mockResolvedValue(Response.json(payload({ item })));
    expect(await fetchPublicHolidays(2026)).toEqual([
      { date: "2026-10-03", name: "개천절" },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "secret-url",
    );
  });
  it("갱신 실패와 백오프 동안 이전 성공 값을 유지해요", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload({ item })));
    const successful = await fetchPublicHolidays(2026);
    vi.advanceTimersByTime(10800000);
    vi.mocked(fetch).mockResolvedValue(
      new Response("<OpenAPI_ServiceResponse />"),
    );
    expect(await fetchPublicHolidays(2026)).toEqual(successful);
    expect(await fetchPublicHolidays(2026)).toEqual(successful);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5 * 60 * 1000);
    vi.mocked(fetch).mockResolvedValue(
      Response.json(payload({ item: { ...item, dateName: "새 공휴일" } })),
    );
    expect(await fetchPublicHolidays(2026)).toEqual([
      { date: "2026-10-03", name: "새 공휴일" },
    ]);
  });
  it("실패한 연도의 백오프가 다른 연도 조회를 막지 않아요", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("failed"));
    await fetchPublicHolidays(2026);
    vi.mocked(fetch).mockResolvedValue(
      Response.json(payload({ item: { ...item, locdate: 20271003 } })),
    );
    expect(await fetchPublicHolidays(2027)).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("목업은 해당 연도만 읽고 외부 API를 부르지 않아요", async () => {
    vi.mocked(mockContext).mockResolvedValue({
      values: new Map(),
      perspective: 0,
      stage: "ready",
    });
    vi.mocked(mockJson).mockResolvedValue([
      { date: "2026-10-03", name: "개천절" },
      { date: "2027-01-01", name: "1월 1일" },
    ]);
    expect(await listHolidays(2026)).toEqual([
      { date: "2026-10-03", name: "개천절" },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
