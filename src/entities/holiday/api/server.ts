import "server-only";
import { unstable_cache } from "next/cache";
import { mockContext, mockJson } from "@/shared/server";
import { holidayResponseSchema } from "../model/holiday.schema";
import type { Holiday } from "./type";

export function parseHolidays(payload: unknown, year: number): Holiday[] {
  const { body } = holidayResponseSchema.parse(payload).response;
  if (body.items === "") {
    if (body.totalCount !== 0) throw new Error("Missing holiday items");
    return [];
  }
  const items = Array.isArray(body.items.item)
    ? body.items.item
    : [body.items.item];
  if (items.length !== body.totalCount)
    throw new Error("Incomplete holiday response");
  if (items.some((item) => !item.locdate.startsWith(`${year}-`))) {
    throw new Error("Unexpected holiday year");
  }
  return items
    .filter((item) => item.isHoliday === "Y")
    .map((item) => ({ date: item.locdate, name: item.dateName }));
}

// 실패 원문은 저장하지 않고 같은 서버 프로세스의 연도별 재시도만 늦춰요.
const retryAfterByYear = new Map<number, number>();
const backoffMs = 5 * 60 * 1000;

async function loadPublicHolidays(year: number): Promise<Holiday[]> {
  if ((retryAfterByYear.get(year) ?? 0) > Date.now()) {
    throw new Error("Holiday request is backing off");
  }
  try {
    const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
    if (!serviceKey) throw new Error("Missing holiday service key");
    const url = new URL(
      "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo",
    );
    // 포털의 일반 키와 URL 인코딩 키를 모두 한 번만 인코딩해요.
    url.search = new URLSearchParams({
      serviceKey: decodeURIComponent(serviceKey),
      solYear: String(year),
      _type: "json",
      numOfRows: "100",
      pageNo: "1",
    }).toString();
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Holiday request failed");
    const holidays = parseHolidays(await response.json(), year);
    retryAfterByYear.delete(year);
    return holidays;
  } catch {
    // 요청 URL과 원본 오류에는 서비스 키가 들어갈 수 있어 기록하지 않아요.
    retryAfterByYear.set(year, Date.now() + backoffMs);
    console.warn(
      `[CAL-17] ${year}년 공휴일 조회에 실패해 잠시 후 다시 시도해요.`,
    );
    // Next의 백그라운드 재검증 로그에도 URL이나 키가 남지 않게 해요.
    throw new Error("Holiday request failed");
  }
}

// 연도 인자도 캐시 키에 포함되며 서비스 키는 포함하지 않아요.
const cachedPublicHolidays = unstable_cache(loadPublicHolidays, ["holidays"], {
  revalidate: 10800,
});

export async function fetchPublicHolidays(year: number): Promise<Holiday[]> {
  try {
    return await cachedPublicHolidays(year);
  } catch {
    // 캐시가 비었을 때만 여기로 오고, 갱신 실패 시 Next는 이전 값을 유지해요.
    return [];
  }
}

export async function listHolidays(year: number): Promise<Holiday[]> {
  if (await mockContext()) {
    return (await mockJson("holidays")).filter((holiday) =>
      holiday.date.startsWith(`${year}-`),
    );
  }
  return fetchPublicHolidays(year);
}
