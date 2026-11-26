import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  projectDeadlineDays,
  projectTimeline,
  type Project,
  type ProjectMilestone,
} from "@/entities/project";
import { List, SectionHeader, TextButton } from "@/shared/ui";
import { ChartContainer } from "@/shared/ui/chart";

const rowLayout =
  "grid grid-cols-[124px_minmax(0,1fr)] items-center gap-3 lg:grid-cols-[168px_minmax(0,1fr)]";
const barFills = {
  past: "var(--sys-gray4)",
  current: "var(--label-secondary)",
  upcoming: "none",
};

function MonthAxis({
  start,
  end,
  span,
}: {
  start: string;
  end: string;
  span: number;
}) {
  const ticks: {
    date: string;
    label: string;
    left: number;
    mobile: boolean;
  }[] = [];
  let last = -4;
  let lastMobile = -9;
  const lastDate = parseISO(end);
  const firstMonth = addMonths(startOfMonth(parseISO(start)), 1);
  for (
    let month = firstMonth, index = 0;
    month <= lastDate;
    month = addMonths(month, 1), index++
  ) {
    const date = format(month, "yyyy-MM-dd");
    const left = (100 * projectDeadlineDays(date, start)) / span;
    if (left > 88) break;
    if (left - last >= 10) {
      const mobile = index % 2 === 0 && left - lastMobile >= 15;
      ticks.push({
        date,
        label: format(month, month.getMonth() === 0 ? "yy.M" : "M월"),
        left,
        mobile,
      });
      last = left;
      if (mobile) lastMobile = left;
    }
  }

  return (
    <div className={rowLayout} aria-hidden>
      <div className="relative col-start-2 h-4 text-caption-sm text-muted-foreground tabular-nums">
        {ticks.map(({ date, label, left, mobile }) => (
          <span
            key={date}
            className={`absolute -translate-x-1/2 whitespace-nowrap ${mobile ? "" : "hidden sm:inline"}`}
            style={{ left: `${left}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MilestoneBar({
  offset,
  length,
  span,
  todayOffset,
  status,
}: {
  offset: number;
  length: number;
  span: number;
  todayOffset: number;
  status: keyof typeof barFills;
}) {
  const strokeWidth = status === "upcoming" ? 1.5 : 0;
  const inset = strokeWidth / 2;
  return (
    <div className="relative h-4 min-w-0" aria-hidden inert>
      <div className="absolute inset-x-0 top-1 h-2 rounded-[var(--r-bar)] bg-fill-quaternary" />
      <ChartContainer className="relative overflow-hidden">
        <BarChart
          data={[{ period: [offset, offset + length] }]}
          layout="vertical"
          accessibilityLayer={false}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis type="number" domain={[0, span]} allowDataOverflow hide />
          <YAxis type="category" hide />
          <Bar
            dataKey="period"
            barSize={8}
            minPointSize={10}
            isAnimationActive={false}
            shape={({ x, y, width, height, parentViewBox }) => (
              <rect
                x={
                  Math.min(x, parentViewBox.x + parentViewBox.width - width) +
                  inset
                }
                y={y + inset}
                width={width - strokeWidth}
                height={height - strokeWidth}
                rx={2}
                fill={barFills[status]}
                stroke="var(--sys-gray3)"
                strokeWidth={strokeWidth}
              />
            )}
          />
          {todayOffset >= 0 && todayOffset < span && (
            <ReferenceLine
              x={todayOffset}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function OverviewTimeline({
  project,
  milestones,
  today,
  onView,
  onSchedule,
}: {
  project: Project;
  milestones: ProjectMilestone[];
  today: string;
  onView: (milestone: ProjectMilestone) => void;
  onSchedule: (milestone: ProjectMilestone) => void;
}) {
  const timeline = projectTimeline(milestones, today).flatMap(
    ({ milestone, status }) =>
      status !== "tentative" && milestone.starts_on
        ? [{ milestone, status, date: milestone.starts_on }]
        : [],
  );
  const tentative = milestones.filter(
    (milestone) => milestone.is_tentative || !milestone.starts_on,
  );
  const firstDate = timeline[0]?.date ?? today;
  const start =
    project.starts_on && project.starts_on < firstDate
      ? project.starts_on
      : firstDate;
  const end = timeline.reduce((latest, { milestone, date }) => {
    const finish = milestone.ends_on ?? date;
    return finish > latest ? finish : latest;
  }, project.target_on ?? start);
  const span = projectDeadlineDays(end, start) + 1;
  const todayOffset = projectDeadlineDays(today, start);

  return (
    <section aria-labelledby="prj-timeline-title" data-od-id="prj-timeline">
      <SectionHeader
        title="타임라인"
        id="prj-timeline-title"
        action={
          <span className="flex items-center gap-1.5 text-caption text-accent-text tabular-nums">
            <span
              className="h-3 w-0.5 rounded-full bg-[var(--accent)]"
              aria-hidden
            />
            오늘 {format(parseISO(today), "M.d")}
          </span>
        }
      />
      {timeline.length ? (
        <>
          <MonthAxis start={start} end={end} span={span} />
          <List variant="divided">
            {timeline.map(({ milestone, status, date }) => {
              const finish = milestone.ends_on ?? date;
              const startLabel = format(parseISO(date), "M.d");
              const period =
                finish === date
                  ? startLabel
                  : `${startLabel} – ${format(parseISO(finish), "M.d")}`;
              const offset = projectDeadlineDays(date, start);
              const length = projectDeadlineDays(finish, date) + 1;
              return (
                <li
                  key={milestone.id}
                  data-od-id={`prj-milestone-${milestone.id}`}
                  className={`relative ${rowLayout}`}
                >
                  <TextButton
                    tone="neutral"
                    size={null}
                    className={[
                      "static block min-h-11 min-w-0 py-2 text-left",
                      "after:inset-0 after:size-full after:transform-none",
                    ].join(" ")}
                    onClick={() => onView(milestone)}
                  >
                    <span className="block truncate text-body-sm font-semibold">
                      {milestone.title}
                    </span>
                    <span className="block text-caption text-muted-foreground tabular-nums">
                      {period}
                      {status === "current" && <span> · 지금</span>}
                    </span>
                  </TextButton>
                  <MilestoneBar
                    offset={offset}
                    length={length}
                    span={span}
                    todayOffset={todayOffset}
                    status={status}
                  />
                </li>
              );
            })}
          </List>
        </>
      ) : (
        <p className="text-caption text-muted-foreground">
          날짜가 있는 마일스톤이 없어요.
        </p>
      )}
      {tentative.length > 0 && (
        <>
          <h3 className="mt-5 text-caption-sm text-muted-foreground">
            날짜 미정
          </h3>
          <List variant="divided">
            {tentative.map((milestone) => (
              <li
                key={milestone.id}
                className="flex min-h-11 items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{milestone.title}</span>
                <TextButton
                  size="sm"
                  className="shrink-0"
                  aria-label={`${milestone.title} 일정에 추가`}
                  onClick={() => onSchedule(milestone)}
                >
                  일정에 추가
                </TextButton>
              </li>
            ))}
          </List>
        </>
      )}
    </section>
  );
}

export default OverviewTimeline;
