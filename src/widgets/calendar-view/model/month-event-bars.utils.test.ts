import { describe, expect, it } from "vitest";
import type { EventOccurrence } from "@/entities/event";
import { monthEventBars, monthEventDots } from "./month-event-bars.utils";

function occurrence(
  id: string,
  startDate: string,
  endDate: string,
): EventOccurrence {
  return {
    startDate,
    endDate,
    dday: null,
    event: {
      id,
      startDate,
      endDate,
      kind: "event",
      ownerId: "owner",
      visibility: "shared",
      startTime: null,
      endTime: null,
      isAllDay: true,
      canEdit: true,
      canChangeVisibility: true,
      details: null,
    },
  };
}

function segments(events: EventOccurrence[]) {
  return monthEventBars(events, "2026-10-18", "2026-10-31");
}

describe("CAL-02 CAL-07 P5.6 월 달력 기간 막대", () => {
  it("하루 일정은 막대에서 빼고 실제 시작과 종료만 둥글게 표시해요", () => {
    const bars = segments([
      occurrence("day", "2026-10-20", "2026-10-20"),
      occurrence("period", "2026-10-20", "2026-10-22"),
    ]);
    expect(bars).toMatchObject([
      {
        occurrence: { event: { id: "period" } },
        startDate: "2026-10-20",
        endDate: "2026-10-22",
        lane: 0,
        startsHere: true,
        endsHere: true,
      },
    ]);
  });

  it("토요일에 끊고 일요일에 이어 그리며 주 경계 끝은 각지게 표시해요", () => {
    expect(
      segments([occurrence("trip", "2026-10-23", "2026-10-27")]),
    ).toMatchObject([
      {
        startDate: "2026-10-23",
        endDate: "2026-10-24",
        startsHere: true,
        endsHere: false,
      },
      {
        startDate: "2026-10-25",
        endDate: "2026-10-27",
        startsHere: false,
        endsHere: true,
      },
    ]);
  });

  it("같은 날 종료와 시작도 겹침으로 보고 세 번째 일정은 색점으로 남겨요", () => {
    const events = [
      occurrence("first", "2026-10-19", "2026-10-22"),
      occurrence("second", "2026-10-22", "2026-10-24"),
      occurrence("hidden", "2026-10-22", "2026-10-23"),
      occurrence("day", "2026-10-22", "2026-10-22"),
    ];
    const bars = segments(events);
    expect(
      bars.map(({ occurrence, lane }) => [occurrence.event.id, lane]),
    ).toEqual([
      ["first", 0],
      ["second", 1],
    ]);
    for (const date of ["2026-10-22", "2026-10-23"]) {
      const daily = events.filter(
        (item) => item.startDate <= date && item.endDate >= date,
      );
      const dailyBars = bars.filter(
        (bar) => bar.startDate <= date && bar.endDate >= date,
      );
      const ids = monthEventDots(daily, dailyBars).map((item) => item.event.id);
      expect(ids).toEqual(
        date === "2026-10-22" ? ["hidden", "day"] : ["hidden"],
      );
    }
  });

  it("끝난 줄을 재사용하고 입력 순서가 바뀌어도 같은 위치에 놓아요", () => {
    const events = [
      occurrence("later", "2026-10-22", "2026-10-24"),
      occurrence("early", "2026-10-18", "2026-10-20"),
      occurrence("overlap", "2026-10-19", "2026-10-23"),
    ];
    const bars = segments(events);
    expect(
      bars.map(({ occurrence, lane }) => [occurrence.event.id, lane]),
    ).toEqual([
      ["early", 0],
      ["overlap", 1],
      ["later", 0],
    ]);
    expect(segments([...events].reverse())).toEqual(bars);
    expect(events[0].event.id).toBe("later");
  });

  it("화면 밖에서 시작하고 끝나는 일정은 보이는 범위만 각지게 그려요", () => {
    const bars = segments([
      occurrence("long", "2026-10-01", "2026-11-05"),
      occurrence("outside", "2026-11-01", "2026-11-03"),
    ]);
    expect(bars).toHaveLength(2);
    expect(bars.every((bar) => !bar.startsHere && !bar.endsHere)).toBe(true);
    expect(bars[0].startDate).toBe("2026-10-18");
    expect(bars[1].endDate).toBe("2026-10-31");
  });

  it("주 마지막 날 시작과 다음 주 첫날 종료의 실제 끝은 둥글게 남겨요", () => {
    expect(
      segments([occurrence("weekend", "2026-10-24", "2026-10-25")]),
    ).toMatchObject([
      { startsHere: true, endsHere: false },
      { startsHere: false, endsHere: true },
    ]);
  });

  it("연도를 넘어가는 일정도 일요일 경계로 나눠요", () => {
    const bars = monthEventBars(
      [occurrence("new-year", "2026-12-31", "2027-01-04")],
      "2026-12-27",
      "2027-01-09",
    );
    expect(bars).toMatchObject([
      { startDate: "2026-12-31", endDate: "2027-01-02" },
      { startDate: "2027-01-03", endDate: "2027-01-04" },
    ]);
  });

  it("지난주에 숨겨졌던 일정도 새 주에 빈 줄이 있으면 다시 보여요", () => {
    const bars = segments([
      occurrence("first", "2026-10-18", "2026-10-24"),
      occurrence("second", "2026-10-18", "2026-10-23"),
      occurrence("continued", "2026-10-20", "2026-10-27"),
    ]);
    const continued = occurrence("continued", "2026-10-20", "2026-10-27");
    expect(
      monthEventDots(
        [continued],
        bars.filter((bar) => bar.endDate === "2026-10-24"),
      ),
    ).toEqual([continued]);
    expect(
      monthEventDots(
        [continued],
        bars.filter((bar) => bar.startDate === "2026-10-25"),
      ),
    ).toEqual([]);
    expect(bars.at(-1)).toMatchObject({
      occurrence: { event: { id: "continued" } },
      startDate: "2026-10-25",
      lane: 0,
      startsHere: false,
      endsHere: true,
    });
  });
});
