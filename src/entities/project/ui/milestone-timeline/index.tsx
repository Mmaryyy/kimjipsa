import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import {
  milestoneCardStyles,
  milestoneDotStyles,
} from "./milestone-timeline.variants";

interface Props {
  days: readonly { date: string; empty: boolean }[];
  today: string;
  renderDay: (index: number, current: boolean) => ReactNode;
}

const MilestoneTimeline = ({ days, today, renderDay }: Props) => (
  <ol
    role="list"
    data-od-id="prj-itinerary-timeline"
    className="mt-4 list-none p-0"
  >
    {days.map(({ date, empty }, index) => {
      const [year, month, day] = date.split("-");
      const current = date === today;

      return (
        <li
          key={date}
          aria-current={current ? "step" : undefined}
          data-od-id={`prj-day-${date}`}
          className={cn(
            "group/day grid grid-cols-[2.5rem_1rem_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0",
            empty && "items-center [--dot-y:50%]",
          )}
        >
          <time
            dateTime={date}
            className={cn(
              "text-center text-caption-sm tabular-nums",
              empty ? "text-label-tertiary" : "pt-2.5 text-muted-foreground",
            )}
          >
            <span className="sr-only">
              {year}년 {Number(month)}월 {Number(day)}일
            </span>
            <span aria-hidden="true">
              <span
                className={cn(
                  "block leading-none font-semibold",
                  empty ? "text-headline" : "text-title-sm text-foreground",
                )}
              >
                {Number(day)}
              </span>
              <span className={cn("block", empty ? "mt-0.5" : "mt-1")}>
                {Number(month)}월
              </span>
            </span>
          </time>
          <div
            aria-hidden="true"
            className="relative flex justify-center self-stretch"
          >
            <span
              className="absolute inset-y-0 -bottom-3 w-px bg-separator-opaque
                group-first/day:top-[var(--dot-y,1.25rem)]
                group-last/day:bottom-auto group-last/day:h-[var(--dot-y,1.25rem)]
                group-only/day:hidden"
            />
            <span className={cn(milestoneDotStyles({ empty, current }))} />
          </div>
          <div className={cn(milestoneCardStyles({ empty, current }))}>
            {renderDay(index, current)}
          </div>
        </li>
      );
    })}
  </ol>
);

export default MilestoneTimeline;
