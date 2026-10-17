import { describe, expect, it } from "vitest";
import { nextDday } from "./dday.utils";
describe("CAL-06 CAL-16 SCN-CAL-9~10 D-day와 주년", () => {
  it("지난 기념일은 다음 해까지 남은 일수를 표시해요", () => {
    expect(
      nextDday("2026-10-11", new Date("2026-10-13T00:00:00+09:00")),
    ).toMatchObject({
      date: "2027-10-11",
      label: "D-363",
      daysUntil: 363,
      anniversary: 1,
    });
  });
  it("12월에서 1월로 넘어가도 날짜 차이를 계산해요", () => {
    expect(
      nextDday("2020-01-01", new Date("2026-12-31T23:59:00+09:00")),
    ).toMatchObject({ date: "2027-01-01", label: "D-1", anniversary: 7 });
  });
  it("서울 자정을 기준으로 당일과 다음 해를 나눠요", () => {
    expect(
      nextDday("2026-10-11", new Date("2027-10-10T15:00:00Z")),
    ).toMatchObject({ label: "D-Day", anniversary: 1 });
    expect(
      nextDday("2026-10-11", new Date("2027-10-11T15:00:00Z")),
    ).toMatchObject({ date: "2028-10-11", label: "D-365" });
  });
  it("등록한 해의 주년은 0이고 미래의 기준 날짜보다 앞서 반복하지 않아요", () => {
    expect(
      nextDday("2026-10-11", new Date("2026-10-11T09:00:00+09:00")).anniversary,
    ).toBe(0);
    expect(
      nextDday("2028-10-11", new Date("2026-10-11T09:00:00+09:00")).date,
    ).toBe("2028-10-11");
  });
  it("윤년 기념일도 등록한 날짜 그대로 반복해요", () => {
    expect(
      nextDday("2024-02-29", new Date("2025-02-28T00:00:00+09:00")).date,
    ).toBe("2028-02-29");
  });
});
