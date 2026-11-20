import type { ReactNode } from "react";
import { StatusBadge } from "@/shared/ui";
import type { ProjectArea, ProjectMilestone } from "../../api/type";
import { projectShortPeriod } from "../../model/project-date.utils";
import { projectTimeline } from "../../model/progress.utils";
import {
  milestoneCardStyles,
  milestoneDotStyles,
} from "./milestone-timeline.variants";

const statusLabels = {
  past: "지난 마일스톤",
  upcoming: "예정된 마일스톤",
  tentative: "날짜 미정",
};

function MilestoneTimeline({
  milestones,
  areas,
  today,
  action,
}: {
  milestones: readonly ProjectMilestone[];
  areas: readonly ProjectArea[];
  today: string;
  action?: (milestone: ProjectMilestone) => ReactNode;
}) {
  const timeline = projectTimeline(milestones, today);
  if (timeline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">아직 마일스톤이 없어요.</p>
    );
  }

  return (
    <ol role="list" data-od-id="prj-timeline" className="list-none p-0">
      {timeline.map(({ milestone, status }) => {
        const { starts_on, ends_on, title, memo, area_id } = milestone;
        const [year, month, day] = starts_on?.split("-") ?? [];
        const area = areas.find((entry) => entry.id === area_id);
        const details = [area?.name, memo].filter(Boolean).join(" · ");
        const period = projectShortPeriod(starts_on, ends_on, "");
        const current = status === "current";

        return (
          <li
            key={milestone.id}
            aria-current={current ? "step" : undefined}
            className="group/milestone grid grid-cols-[2.5rem_1rem_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0"
          >
            <div className="pt-2.5 text-center text-xs text-muted-foreground">
              {starts_on ? (
                <time dateTime={starts_on}>
                  <span className="sr-only">
                    {year}년 {Number(month)}월 {Number(day)}일
                  </span>
                  <span aria-hidden="true">
                    <span className="block text-lg leading-none font-semibold text-foreground">
                      {Number(day)}
                    </span>
                    <span className="mt-1 block">{Number(month)}월</span>
                  </span>
                </time>
              ) : (
                <span>미정</span>
              )}
            </div>
            <div aria-hidden="true" className="relative flex justify-center">
              <span
                className="absolute inset-y-0 -bottom-3 w-px bg-border
                  group-first/milestone:top-5 group-last/milestone:bottom-auto
                  group-last/milestone:h-5 group-only/milestone:hidden"
              />
              <span className={milestoneDotStyles({ status })} />
            </div>
            <div className={milestoneCardStyles({ status })}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold wrap-anywhere">{title}</h3>
                {current ? (
                  <StatusBadge shape="capsule" variant="progress">
                    지금
                  </StatusBadge>
                ) : (
                  <span className="sr-only">{statusLabels[status]}</span>
                )}
              </div>
              {period && (
                <p className="text-sm text-muted-foreground">{period}</p>
              )}
              {details && (
                <p className="truncate text-sm text-muted-foreground">
                  {details}
                </p>
              )}
              {action?.(milestone)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default MilestoneTimeline;
