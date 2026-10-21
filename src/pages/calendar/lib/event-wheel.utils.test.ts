import { describe, expect, it } from "vitest";
import {
  dateOptions,
  defaultEventRange,
  hourTo12,
  hourTo24,
  initialWheelRange,
  moveEventStart,
} from "./event-wheel.utils";
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
    expect(moveEventStart(range, "2026-12-31", "23:50")).toEqual({
      startDate: "2026-12-31",
      endDate: "2027-01-01",
      startTime: "23:50",
      endTime: "00:19",
    });
  });
  it("시각 없는 기간과 한쪽만 시각 있는 일정은 날짜 길이와 빈 시각을 유지해요", () => {
    expect(
      moveEventStart(
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
      moveEventStart({ ...range, endTime: "" }, "2026-10-22", "14:00").endTime,
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
  it("윤일도 포함하고 오늘 표시와 기준일 앞뒤 1년 범위를 제공해요", () => {
    const options = dateOptions("2028-02-29", "2028-02-29");
    expect(options[0].value).toBe("2027-02-28");
    expect(options.at(-1)?.value).toBe("2029-02-28");
    expect(options.find((option) => option.value === "2028-02-29")?.label).toBe(
      "오늘",
    );
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
it("CAL-02 SCN-CAL-1 날짜 범위는 양쪽 기준일 앞뒤 일 년을 모두 포함해요", () => {
  const options = dateOptions("2026-10-21", "2026-10-21", "2027-10-21");
  expect(options[0].value).toBe("2025-10-21");
  expect(options.at(-1)?.value).toBe("2028-10-21");
  const next = moveEventStart(
    { ...range, endDate: "2027-10-21" },
    "2027-10-21",
    range.startTime,
  );
  expect(options.some(({ value }) => value === next.endDate)).toBe(true);
});
it("CAL-01 SCN-CAL-1 선택일의 다음 정시가 밤 열한 시면 종료는 다음 날이에요", () => {
  expect(
    defaultEventRange("2026-11-01", new Date("2026-10-21T22:30:00+09:00")),
  ).toEqual({
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    startTime: "23:00",
    endTime: "00:00",
  });
});
