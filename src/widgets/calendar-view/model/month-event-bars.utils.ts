import { addDays, format } from "date-fns";
import { kstDate, type EventOccurrence } from "@/entities/event";

export type MonthEventBar = {
  occurrence: EventOccurrence;
  startDate: string;
  endDate: string;
  lane: 0 | 1;
  startsHere: boolean;
  endsHere: boolean;
};

/** 막대로 표시되지 않은 일정은 하루 일정과 같은 색점으로 남긴다. */
export function monthEventDots(
  daily: EventOccurrence[],
  bars: MonthEventBar[],
): EventOccurrence[] {
  return daily.filter(
    ({ event }) => !bars.some((bar) => bar.occurrence.event.id === event.id),
  );
}

/** 일요일 시작의 각 주에서 겹치지 않는 첫 줄에 배치하고 넘친 구간은 색점으로 표시한다. */
export function monthEventBars(
  occurrences: EventOccurrence[],
  gridStart: string,
  gridEnd: string,
): MonthEventBar[] {
  const periods = occurrences
    .filter(({ startDate, endDate }) => startDate !== endDate)
    .toSorted(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        b.endDate.localeCompare(a.endDate) ||
        a.event.id.localeCompare(b.event.id),
    );
  const bars: MonthEventBar[] = [];
  for (
    let weekStart = gridStart;
    weekStart <= gridEnd;
    weekStart = format(addDays(kstDate(weekStart), 7), "yyyy-MM-dd")
  ) {
    const weekEnd = format(addDays(kstDate(weekStart), 6), "yyyy-MM-dd");
    const visibleEnd = weekEnd < gridEnd ? weekEnd : gridEnd;
    const laneEnds = ["", ""];
    for (const occurrence of periods) {
      if (occurrence.startDate > visibleEnd || occurrence.endDate < weekStart)
        continue;
      const startDate =
        occurrence.startDate < weekStart ? weekStart : occurrence.startDate;
      const endDate =
        occurrence.endDate > visibleEnd ? visibleEnd : occurrence.endDate;
      const lane = ([0, 1] as const).find(
        (index) => laneEnds[index] < startDate,
      );
      if (lane === undefined) continue;
      laneEnds[lane] = endDate;
      bars.push({
        occurrence,
        startDate,
        endDate,
        lane,
        startsHere: startDate === occurrence.startDate,
        endsHere: endDate === occurrence.endDate,
      });
    }
  }
  return bars;
}
