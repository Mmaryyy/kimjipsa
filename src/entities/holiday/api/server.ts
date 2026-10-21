import "server-only";
import { unstable_cache } from "next/cache";
import { mockContext, mockJson } from "@/shared/server";
import {
  holidayResponseSchema,
  specialDayResponseSchema,
} from "../model/holiday.schema";
import type { Holiday, SpecialDay } from "./type";

export function parseHolidays(
  payload: unknown,
  year: number,
  kind: "holiday" | SpecialDay["kind"] = "holiday",
): Holiday[] {
  const schema =
    kind === "holiday" ? holidayResponseSchema : specialDayResponseSchema;
  const { body } = schema.parse(payload).response;
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
    .filter((item) => kind !== "holiday" || item.isHoliday === "Y")
    .map((item) => ({ date: item.locdate, name: item.dateName }));
}

// 실패 원문은 저장하지 않고 같은 서버 프로세스의 연도별 재시도만 늦춰요.
const operations = {
  holiday: "getRestDeInfo",
  solarTerm: "get24DivisionsInfo",
  sundry: "getSundryDayInfo",
} as const;
const retryAfterByYear = new Map<string, number>();
const backoffMs = 5 * 60 * 1000;

async function loadSpecialDates(
  year: number,
  kind: keyof typeof operations,
): Promise<Holiday[]> {
  const retryKey = `${kind}:${year}`;
  if ((retryAfterByYear.get(retryKey) ?? 0) > Date.now()) {
    throw new Error("Holiday request is backing off");
  }
  try {
    const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
    if (!serviceKey) throw new Error("Missing holiday service key");
    const url = new URL(
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/${operations[kind]}`,
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
    const holidays = parseHolidays(await response.json(), year, kind);
    retryAfterByYear.delete(retryKey);
    return holidays;
  } catch {
    // 요청 URL과 원본 오류에는 서비스 키가 들어갈 수 있어 기록하지 않아요.
    retryAfterByYear.set(retryKey, Date.now() + backoffMs);
    console.warn(
      `[CAL-17] ${year}년 ${kind} 특일정보 조회에 실패해 잠시 후 다시 시도해요.`,
    );
    // Next의 백그라운드 재검증 로그에도 URL이나 키가 남지 않게 해요.
    throw new Error("Holiday request failed");
  }
}

// 연도 인자도 캐시 키에 포함되며 서비스 키는 포함하지 않아요.
const cachedPublicHolidays = unstable_cache(
  (year: number) => loadSpecialDates(year, "holiday"),
  ["holidays"],
  { revalidate: 10800 },
);
const cachedSolarTerms = unstable_cache(
  (year: number) => loadSpecialDates(year, "solarTerm"),
  ["solar-terms"],
  { revalidate: 10800 },
);
const cachedSundryDays = unstable_cache(
  (year: number) => loadSpecialDates(year, "sundry"),
  ["sundry-days"],
  { revalidate: 10800 },
);

export async function fetchSpecialDays(
  year: number,
  kind: SpecialDay["kind"],
): Promise<SpecialDay[]> {
  try {
    const cached = kind === "solarTerm" ? cachedSolarTerms : cachedSundryDays;
    return (await cached(year)).map((day) => ({ ...day, kind }));
  } catch {
    return [];
  }
}

export async function listSpecialDays(year: number): Promise<SpecialDay[]> {
  if (await mockContext()) {
    return (await mockJson("special-days")).filter((day) =>
      day.date.startsWith(`${year}-`),
    );
  }
  const [solarTerms, sundryDays] = await Promise.all([
    fetchSpecialDays(year, "solarTerm"),
    fetchSpecialDays(year, "sundry"),
  ]);
  return [...solarTerms, ...sundryDays];
}

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
