import { describe, expect, it } from "vitest";
import {
  changeWheelDate,
  dateWheelOptions,
  defaultDateRange,
  hourTo12,
  hourTo24,
  initialWheelRange,
  moveRangeStart,
} from "@/shared/ui/date-time-input";
import { eventFormSchema } from "../model/event-form.schema";

const range = {
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  startTime: "23:30",
  endTime: "23:59",
};
const input = {
  ...range,
  title: "약속",
  place: "",
  memo: "",
  categoryId: "00000000-0000-4000-8000-000000000001",
  visibility: "shared",
  isAllDay: false,
};

describe("CAL-01 CAL-02 SCN-CAL-1 P5.5 날짜와 시간 변환", () => {
  it.each([
    ["00:00", "am", "12", "00"],
    ["12:00", "pm", "12", "00"],
    ["13:07", "pm", "1", "07"],
    ["23:59", "pm", "11", "59"],
  ])(
    "%s를 12시간제로 바꾸고 원래 시각으로 되돌려요",
    (time, period, hour, minute) => {
      expect(hourTo12(time)).toEqual({ period, hour, minute });
      expect(hourTo24(period, hour, minute)).toBe(time);
    },
  );
  it("시작을 옮기면 자정을 넘어도 종료가 같은 길이로 따라와요", () => {
    expect(moveRangeStart(range, "2026-12-31", "23:50")).toEqual({
      startDate: "2026-12-31",
      endDate: "2027-01-01",
      startTime: "23:50",
      endTime: "00:19",
    });
  });
  it("시각 없는 기간과 한쪽만 시각 있는 일정은 날짜 길이와 빈 시각을 유지해요", () => {
    expect(
      moveRangeStart(
        { ...range, endDate: "2026-10-23", startTime: "", endTime: "" },
        "2026-10-25",
        "",
      ),
    ).toEqual({
      startDate: "2026-10-25",
      endDate: "2026-10-27",
      startTime: "",
      endTime: "",
    });
    expect(
      moveRangeStart({ ...range, endTime: "" }, "2026-10-22", "14:00").endTime,
    ).toBe("");
  });
  it("시간 미정과 종일은 시각을 비우고 구분해 저장해요", () => {
    expect(
      eventFormSchema.parse({ ...input, isTimeUnknown: true }),
    ).toMatchObject({ startTime: null, endTime: null, isAllDay: false });
    expect(eventFormSchema.parse({ ...input, isAllDay: true })).toMatchObject({
      startTime: null,
      endTime: null,
      isAllDay: true,
    });
    expect(initialWheelRange(range, true)).toMatchObject({
      startTime: "",
      endTime: "",
    });
  });
});

it("CAL-01 SCN-CAL-1 한쪽 시각만 있는 일정은 확인할 초기 값에서도 빈 시각을 유지해요", () => {
  expect(initialWheelRange({ ...range, endTime: "" }, false)).toEqual({
    ...range,
    endTime: "",
  });
  expect(initialWheelRange({ ...range, startTime: "" }, false)).toEqual({
    ...range,
    startTime: "",
  });
});
describe("CAL-01 CAL-02 SCN-CAL-1 P10.6.3 연·월·일 휠", () => {
  it("1900~2100년과 2021년 2월 8일을 선택할 옵션을 제공해요", () => {
    const options = dateWheelOptions("2021-02-08");
    expect(options.years).toHaveLength(201);
    expect(options.years[0].value).toBe("1900");
    expect(options.years.at(-1)?.value).toBe("2100");
    expect(options.years).toContainEqual({ value: "2021", label: "2021년" });
    expect(options.months).toContainEqual({ value: "02", label: "2월" });
    expect(options.days).toContainEqual({ value: "08", label: "8일" });
    expect(
      changeWheelDate("2026-11-03", { year: "2021", month: "02", day: "08" }),
    ).toBe("2021-02-08");
  });
  it("윤년에서 평년으로 바꾸면 2월 29일을 28일로 맞춰요", () => {
    expect(changeWheelDate("2024-02-29", { year: "2025" })).toBe("2025-02-28");
    expect(dateWheelOptions("2024-02-29").days).toHaveLength(29);
    expect(dateWheelOptions("2025-02-28").days).toHaveLength(28);
  });
  it("월을 바꾸면 일 수를 바꾸고 없는 날은 마지막 날로 맞춰요", () => {
    expect(changeWheelDate("2026-01-31", { month: "04" })).toBe("2026-04-30");
    expect(dateWheelOptions("2026-01-31").days).toHaveLength(31);
    expect(dateWheelOptions("2026-04-30").days).toHaveLength(30);
    expect(dateWheelOptions("1900-02-01").days).toHaveLength(28);
    expect(dateWheelOptions("2000-02-01").days).toHaveLength(29);
  });
  it.each(["1899", "2101"])(
    "범위 밖 초기 연도 %s도 목록에 포함해요",
    (year) => {
      expect(dateWheelOptions(`${year}-01-01`).years).toContainEqual({
        value: year,
        label: `${year}년`,
      });
    },
  );
  it("과거로 시작을 옮겨도 종료가 같은 기간만큼 따라가요", () => {
    expect(
      moveRangeStart(
        { ...range, endDate: "2026-10-23" },
        "2021-02-08",
        range.startTime,
      ),
    ).toEqual({
      ...range,
      startDate: "2021-02-08",
      endDate: "2021-02-10",
    });
  });
});
it("CAL-01 SCN-CAL-1 선택일의 다음 정시가 밤 열한 시면 종료는 다음 날이에요", () => {
  expect(
    defaultDateRange("2026-11-01", new Date("2026-10-21T22:30:00+09:00")),
  ).toEqual({
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    startTime: "23:00",
    endTime: "00:00",
  });
});
