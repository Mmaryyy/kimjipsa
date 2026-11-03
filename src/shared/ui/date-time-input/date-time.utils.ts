import { TZDate, tz } from "@date-fns/tz";
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  getDaysInMonth,
  isValid,
  startOfHour,
} from "date-fns";
import { ko } from "date-fns/locale";

export type DateTimeRange = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export function wheelDate(date: string, time = "00:00") {
  return new TZDate(`${date}T${time || "00:00"}:00+09:00`, "Asia/Seoul");
}

export function hourTo12(time: string) {
  const hour = Number(time.split(":")[0]);
  return {
    period: hour < 12 ? "am" : "pm",
    hour: String(hour % 12 || 12),
    minute: time.slice(3, 5),
  };
}

export function hourTo24(period: string, hour: string, minute: string) {
  const value = (Number(hour) % 12) + (period === "pm" ? 12 : 0);
  return `${String(value).padStart(2, "0")}:${minute}`;
}

export function dateLabel(date: string, pattern = "yyyy년 M월 d일") {
  const value = wheelDate(date);
  return isValid(value) ? format(value, pattern, { locale: ko }) : "날짜 선택";
}

export function timeLabel(time: string) {
  if (!time) return "시각 선택";
  const { period, hour, minute } = hourTo12(time);
  return `${period === "am" ? "오전" : "오후"} ${hour}:${minute}`;
}

// 월의 일 수는 과거 서울 오프셋의 영향을 피하도록 연·월 숫자로만 계산한다.
export function dateWheelOptions(date: string) {
  const [year, month] = date.split("-");
  const years = Array.from({ length: 201 }, (_, index) => 1900 + index);
  if (Number(year) < 1900) years.unshift(Number(year));
  if (Number(year) > 2100) years.push(Number(year));
  return {
    years: years.map((value) => ({
      value: String(value),
      label: `${value}년`,
    })),
    months: Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1).padStart(2, "0"),
      label: `${index + 1}월`,
    })),
    days: Array.from(
      { length: getDaysInMonth(new Date(Number(year), Number(month) - 1, 1)) },
      (_, index) => ({
        value: String(index + 1).padStart(2, "0"),
        label: `${index + 1}일`,
      }),
    ),
  };
}

export function changeWheelDate(
  date: string,
  part: { year?: string; month?: string; day?: string },
) {
  const [currentYear, currentMonth, currentDay] = date.split("-");
  const year = part.year ?? currentYear;
  const month = part.month ?? currentMonth;
  const day = Math.min(
    Number(part.day ?? currentDay),
    getDaysInMonth(new Date(Number(year), Number(month) - 1, 1)),
  );
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

/** 시각이 각각 선택인 기존 일정도 빈 시각을 채우지 않고 날짜 길이를 보존한다. */
export function moveRangeStart(
  range: DateTimeRange,
  startDate: string,
  startTime: string,
): DateTimeRange {
  if (
    ![range.startDate, range.endDate, startDate].every((date) =>
      isValid(wheelDate(date)),
    )
  ) {
    return { ...range, startDate, startTime };
  }
  if (range.startTime && range.endTime && startTime) {
    const duration = differenceInMinutes(
      wheelDate(range.endDate, range.endTime),
      wheelDate(range.startDate, range.startTime),
    );
    const end = addMinutes(wheelDate(startDate, startTime), duration);
    return {
      startDate,
      startTime,
      endDate: format(end, "yyyy-MM-dd"),
      endTime: format(end, "HH:mm"),
    };
  }
  const days = differenceInCalendarDays(
    wheelDate(startDate),
    wheelDate(range.startDate),
  );
  return {
    ...range,
    startDate,
    startTime,
    endDate: format(addDays(wheelDate(range.endDate), days), "yyyy-MM-dd"),
  };
}

export function initialWheelRange(range: DateTimeRange, dateOnly: boolean) {
  return dateOnly ? { ...range, startTime: "", endTime: "" } : { ...range };
}

export function defaultDateRange(
  initialDate?: string,
  instant = new Date(),
): DateTimeRange {
  const nextHour = startOfHour(
    addMinutes(new TZDate(instant, "Asia/Seoul"), 60),
  );
  const startDate = initialDate ?? format(nextHour, "yyyy-MM-dd");
  const startTime = format(nextHour, "HH:mm");
  const end = addMinutes(wheelDate(startDate, startTime), 60);
  return {
    startDate,
    startTime,
    endDate: format(end, "yyyy-MM-dd"),
    endTime: format(end, "HH:mm"),
  };
}

export function todayInSeoul() {
  return format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
}
