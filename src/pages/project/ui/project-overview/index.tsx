"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ProjectProgressBar,
  projectDeadlineDays,
  projectOverdue,
  projectProgress,
  projectShortPeriod,
  projectToday,
  taskStatusLabels,
  upcomingTasks,
  useProject,
  type ProjectDetail,
  type ProjectMilestone,
  type ProjectTask,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { MilestoneEditor, ProjectEventAction } from "@/features/project-edit";
import { ApiError } from "@/shared/api";
import {
  Button,
  ErrorState,
  ListSkeleton,
  PageLayout,
  SectionHeader,
  Sheet,
  TextButton,
} from "@/shared/ui";
import ProjectBackLink from "../project-header";
import OverviewDeadlines from "./OverviewDeadlines";
import OverviewModules from "./OverviewModules";
import OverviewSettings from "./OverviewSettings";
import OverviewTimeline from "./OverviewTimeline";

const statusColors = {
  done: "bg-success",
  in_progress: "bg-sys-cyan",
  todo: "bg-sys-gray5",
  on_hold: "bg-warning",
};
const cellStyle = "inline-block size-3 rounded-[var(--r-bar)]";

function OverviewSummary({
  project,
  tasks,
  today,
}: Pick<ProjectDetail, "project" | "tasks"> & { today: string }) {
  const progress = projectProgress(tasks);
  const { count } = projectOverdue(tasks, today);
  const soon = upcomingTasks(tasks, today).filter(
    (task) => task.due_on && projectDeadlineDays(task.due_on, today) <= 7,
  ).length;
  let target = "목표일 미정";
  if (project.target_on) {
    const days = projectDeadlineDays(project.target_on, today);
    if (days > 0) target = `D-${days}`;
    else if (days === 0) target = "오늘";
    else target = `${-days}일 지남`;
  }

  const stats = [
    { label: "남은 할 일", value: progress.total - progress.done },
    { label: "늦어진 일", value: count, late: count > 0 },
    { label: "7일 안 마감", value: soon },
  ];

  return (
    <section
      aria-label="전체 준비"
      data-od-id="prj-overview-summary"
      className="mt-4 rounded-[var(--r-control)] bg-fill-quaternary p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong
          className={
            project.target_on
              ? [
                  "text-[length:var(--type-display-size)] leading-[var(--type-display-lh)]",
                  "font-bold tracking-[var(--type-display-tracking)] tabular-nums",
                ].join(" ")
              : "text-title"
          }
        >
          {target}
        </strong>
        {project.target_on && (
          <time
            dateTime={project.target_on}
            className="text-body-sm text-muted-foreground"
          >
            {format(parseISO(project.target_on), "M월 d일 (EEE)", {
              locale: ko,
            })}{" "}
            목표
          </time>
        )}
      </div>
      <div
        className="mt-3 flex items-center gap-3"
        data-od-id="prj-overview-progress"
      >
        <ProjectProgressBar
          done={progress.done}
          total={progress.total}
          label={`할 일 ${progress.total}개 중 ${progress.done}개 완료`}
          className={[
            "h-1.5 flex-1 overflow-hidden rounded-full bg-fill-tertiary",
            "[&::-webkit-progress-bar]:bg-transparent",
            "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
            "[&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
          ].join(" ")}
        />
        <strong className="text-caption font-semibold tabular-nums">
          {progress.percent}%
        </strong>
      </div>
      <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-3 gap-y-3.5">
        {stats.map(({ label, value, late }) => (
          <div key={label}>
            <dt className="text-caption-sm font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-headline font-semibold tabular-nums">
              {late && (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-warning"
                />
              )}
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AreaProgress({
  name,
  tasks,
  odId,
}: {
  name: string;
  tasks: ProjectTask[];
  odId: string;
}) {
  const { done, total } = projectProgress(tasks);
  return (
    <li className="py-2" data-od-id={odId}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate font-semibold">{name}</h3>
        <span className="text-caption text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>
      {total ? (
        <ul
          className="mt-2 flex flex-wrap gap-[3px]"
          aria-label={`${name} 할 일 상태`}
        >
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`${cellStyle} ${statusColors[task.status]}`}
              title={task.title}
            >
              <span className="sr-only">
                {task.title} · {taskStatusLabels[task.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-caption text-muted-foreground">할 일 없음</p>
      )}
    </li>
  );
}

function OverviewAreas({
  areas,
  tasks,
}: Pick<ProjectDetail, "areas" | "tasks">) {
  const grouped = Map.groupBy(tasks, (task) => task.area_id);
  const ungrouped = grouped.get(null);
  return (
    <section
      aria-labelledby="prj-area-progress-title"
      data-od-id="prj-area-cells"
    >
      <SectionHeader title="영역별 할 일" id="prj-area-progress-title" />
      {areas.length || ungrouped ? (
        <>
          <ul className="space-y-2" data-od-id="prj-area-progress">
            {areas.map((area) => (
              <AreaProgress
                key={area.id}
                name={area.name}
                tasks={grouped.get(area.id) ?? []}
                odId={`prj-area-${area.id}`}
              />
            ))}
            {ungrouped && (
              <AreaProgress
                name="영역 없음"
                tasks={ungrouped}
                odId="prj-area-none"
              />
            )}
          </ul>
          <ul
            className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption-sm text-muted-foreground"
            aria-label="범례"
          >
            {Object.entries(statusColors).map(([status, color]) => (
              <li className="flex items-center gap-1.5" key={status}>
                <span aria-hidden className={`${cellStyle} ${color}`} />
                {taskStatusLabels[status as ProjectTask["status"]]}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-caption text-muted-foreground">
          영역을 나누면 진행을 묶어 볼 수 있어요.
        </p>
      )}
    </section>
  );
}

function ProjectOverview({ id }: { id: string }) {
  const query = useProject(id);
  const { data: account } = useAccount();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewing, setViewing] = useState<string>();
  const [scheduling, setScheduling] = useState<ProjectMilestone>();
  const navigation = <ProjectBackLink href="/projects" label="프로젝트 목록" />;
  const unavailable =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  if (!query.data || unavailable)
    return (
      <PageLayout
        width="narrow"
        odId="prj-overview"
        header={{ title: "프로젝트", navigation }}
      >
        {query.isPending ? (
          <ListSkeleton />
        ) : (
          <ErrorState
            message={query.error?.message}
            onRetry={() => void query.refetch()}
          />
        )}
      </PageLayout>
    );

  const data = query.data;
  const { project, areas, milestones, tasks } = data;
  const today = projectToday();
  const remaining = tasks.filter((task) => task.status !== "done").length;
  const amountFormat = account?.amountFormat ?? "won";
  const milestone = milestones.find((item) => item.id === viewing);

  return (
    <PageLayout
      width="narrow"
      odId="prj-overview"
      header={{
        title: project.title,
        titleOdId: "prj-overview-title",
        navigation,
        actions: (
          <Button
            variant="glass"
            data-od-id="prj-settings-open"
            onClick={() => setSettingsOpen(true)}
          >
            설정
          </Button>
        ),
      }}
    >
      <OverviewSummary project={project} tasks={tasks} today={today} />
      <OverviewDeadlines
        data={data}
        today={today}
        amountFormat={amountFormat}
      />
      <OverviewTimeline
        project={project}
        milestones={milestones}
        today={today}
        onView={(item) => setViewing(item.id)}
        onSchedule={setScheduling}
      />
      <OverviewAreas areas={areas} tasks={tasks} />
      <OverviewModules
        data={data}
        remaining={remaining}
        amountFormat={amountFormat}
      />
      {settingsOpen && (
        <OverviewSettings data={data} onClose={() => setSettingsOpen(false)} />
      )}
      {milestone && !scheduling && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setViewing(undefined);
          }}
          title={milestone.title}
          description="마일스톤 상세"
          leadingAction={() => (
            <TextButton
              size="sm"
              tone="neutral"
              onClick={() => setViewing(undefined)}
            >
              닫기
            </TextButton>
          )}
        >
          <p className="text-caption text-muted-foreground">
            {projectShortPeriod(
              milestone.starts_on,
              milestone.ends_on,
              "날짜 미정",
            )}
          </p>
          {milestone.memo && (
            <p className="mt-2 whitespace-pre-wrap">{milestone.memo}</p>
          )}
          <ProjectEventAction row={milestone} source="milestones" />
        </Sheet>
      )}
      {scheduling && (
        <MilestoneEditor
          projectId={id}
          areas={areas}
          milestones={milestones}
          initialMilestoneId={scheduling.id}
          afterSave={(milestoneId, item) => {
            if (item.starts_on) setViewing(milestoneId);
          }}
          onClose={() => setScheduling(undefined)}
        />
      )}
    </PageLayout>
  );
}

export default ProjectOverview;
