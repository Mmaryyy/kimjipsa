import type * as SharedServer from "@/shared/server";
import type * as HolidayServer from "@/entities/holiday/index.server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/entities/user/index.server", () => ({
  authenticatedClient: vi.fn(),
}));
vi.mock("@/shared/server", async (original) => ({
  ...(await original<typeof SharedServer>()),
  mockContext: vi.fn(),
}));
vi.mock("@/entities/holiday/index.server", async (original) => ({
  ...(await original<typeof HolidayServer>()),
  listHolidays: vi.fn(),
  listSpecialDays: vi.fn(),
}));
import { ApiError } from "@/shared/api";
import { mockContext } from "@/shared/server";
import { authenticatedClient } from "@/entities/user/index.server";
import { listHolidays, listSpecialDays } from "@/entities/holiday/index.server";
import { holidaysGET } from "./holiday-routes";
function request(year: string) {
  return new Request(`http://localhost/api/holidays${year}`);
}
describe("CAL-17 공휴일 라우트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSpecialDays).mockResolvedValue([]);
    vi.mocked(mockContext).mockResolvedValue(null);
  });
  it("로그인이 없으면 조회를 거부해요", async () => {
    vi.mocked(authenticatedClient).mockRejectedValue(
      new ApiError("unauthorized", "로그인이 필요해요.", 401),
    );
    const response = await holidaysGET(request("?year=2026"));
    expect(response.status).toBe(401);
    expect(listHolidays).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "?year=abc",
    "?year=2026.5",
    "?year=1899",
    "?year=2101",
    "?year=2e3",
  ])("연도 %s는 검증 오류예요", async (query) => {
    vi.mocked(authenticatedClient).mockResolvedValue(
      {} as Awaited<ReturnType<typeof authenticatedClient>>,
    );
    const response = await holidaysGET(request(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "validation_failed" },
    });
    expect(listHolidays).not.toHaveBeenCalled();
  });
  it("로그인 후 검증한 연도의 목록을 반환해요", async () => {
    vi.mocked(authenticatedClient).mockResolvedValue(
      {} as Awaited<ReturnType<typeof authenticatedClient>>,
    );
    vi.mocked(listHolidays).mockResolvedValue([
      { date: "2026-10-09", name: "한글날" },
    ]);
    const response = await holidaysGET(request("?year=2026"));
    expect(await response.json()).toEqual({
      ok: true,
      data: [{ date: "2026-10-09", name: "한글날", kind: "holiday" }],
    });
    expect(listHolidays).toHaveBeenCalledWith(2026);
  });
  it("CAL-17 같은 날의 공휴일과 절기를 종류와 함께 모두 반환해요", async () => {
    vi.mocked(authenticatedClient).mockResolvedValue(
      {} as Awaited<ReturnType<typeof authenticatedClient>>,
    );
    vi.mocked(listHolidays).mockResolvedValue([
      { date: "2026-05-05", name: "어린이날" },
    ]);
    vi.mocked(listSpecialDays).mockResolvedValue([
      { date: "2026-05-05", name: "입하", kind: "solarTerm" },
    ]);
    const response = await holidaysGET(request("?year=2026"));
    expect(await response.json()).toEqual({
      ok: true,
      data: [
        { date: "2026-05-05", name: "어린이날", kind: "holiday" },
        { date: "2026-05-05", name: "입하", kind: "solarTerm" },
      ],
    });
  });
});
