"use client";
import { useState } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import {
  ProjectProgressBar,
  projectDeadlineDays,
  projectPeriod,
  projectShortPeriod,
  projectStatuses,
  projectStatusLabels,
  projectToday,
  useProjects,
  type ProjectListEntry,
} from "@/entities/project";
import { ProjectEditor } from "@/features/project-edit";
import {
  Button,
  EmptyState,
  ErrorState,
  FilterTabs,
  List,
  ListSkeleton,
  PageLayout,
  StatusBadge,
  Text,
} from "@/shared/ui";
import {
  projectDeadlineStyles,
  projectFilterTabsStyles,
} from "./projects-page.variants";

const statuses = projectStatuses.map((value) => ({
  value,
  label: projectStatusLabels[value],
}));

const emptyMessages = {
  active: "진행 중인 프로젝트가 없어요.",
  completed: "완료한 프로젝트가 없어요.",
  archived: "보관한 프로젝트가 없어요.",
} as const;

function DeadlineBadge({ days, prefix }: { days: number; prefix?: string }) {
  if (days < 0) {
    return (
      <StatusBadge
        variant="warning"
        className={projectDeadlineStyles({
          tone: "later",
          className: "text-foreground",
        })}
      >
        {prefix}
        {-days}일 지남
      </StatusBadge>
    );
  }

  const tone = days === 0 ? "today" : days <= 7 ? "soon" : "later";
  return (
    <Text variant="caption" className={projectDeadlineStyles({ tone })}>
      {days === 0 ? "오늘" : `D-${days}`}
    </Text>
  );
}

function ProjectListRow({
  project,
  progress,
  next,
  overdue,
  today,
}: ProjectListEntry & { today: string }) {
  const active = project.status === "active";
  const target = project.target_on;
  const start = project.starts_on;
  let period = "기간 미정";
  if (target) period = `${projectPeriod(null, target, "")}까지`;
  else if (start)
    period = `${projectPeriod(start, null, "")} 시작 · 목표일 미정`;

  const nextDeadline = active && next?.due_on && (
    <Text
      as="p"
      variant="caption"
      tone="muted"
      className="mt-2 flex items-center gap-2"
    >
      <span className="shrink-0">다음</span>
      <strong className="min-w-0 truncate font-medium text-foreground">
        {next.title}
      </strong>
      <time className="shrink-0 tabular-nums" dateTime={next.due_on}>
        {projectShortPeriod(next.due_on, null, "")}
      </time>
    </Text>
  );

  const progressSummary =
    progress.total > 0 ? (
      <div className="mt-3 flex items-center gap-3">
        <ProjectProgressBar
          done={progress.done}
          total={progress.total}
          label={`${project.title} 할 일 완료`}
          className={[
            "h-1 min-w-0 flex-1 overflow-hidden rounded-[var(--r-bar)]",
            "bg-[var(--fill-tertiary)] [&::-webkit-progress-bar]:bg-transparent",
            "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
            "[&::-webkit-progress-value]:rounded-[inherit] [&::-moz-progress-bar]:rounded-[inherit]",
          ].join(" ")}
        />
        <Text variant="caption" className="shrink-0 font-semibold tabular-nums">
          {progress.done}/{progress.total}
        </Text>
      </div>
    ) : (
      <Text as="p" variant="caption" tone="muted">
        아직 할 일이 없어요
      </Text>
    );

  return (
    <li data-od-id={`prj-row-${project.id}`}>
      <Link href={`/projects/${project.id}`} className="block py-4">
        <div className="flex items-baseline gap-3">
          <Text as="h2" variant="headline" className="min-w-0 flex-1">
            {project.title}
          </Text>
          {active && target && (
            <DeadlineBadge days={projectDeadlineDays(target, today)} />
          )}
        </div>
        <Text
          as="p"
          variant="caption"
          tone="muted"
          className="mt-half tabular-nums"
        >
          {period}
        </Text>
        {progressSummary}
        {active && overdue.count > 0 && (
          <p className="mt-2">
            <DeadlineBadge
              days={-overdue.oldestDays}
              prefix={`늦어진 할 일 ${overdue.count}개 · `}
            />
          </p>
        )}
        {nextDeadline}
      </Link>
    </li>
  );
}

export default function ProjectsPage() {
  const query = useProjects();
  const today = projectToday();
  const [status, setStatus] =
    useState<(typeof projectStatuses)[number]>("active");
  const [creating, setCreating] = useState(false);
  const projects = query.data?.entries.filter(
    (entry) => entry.project.status === status,
  );

  return (
    <PageLayout
      width="narrow"
      odId="prj-projects"
      header={{
        title: "프로젝트",
        titleOdId: "prj-projects-title",
        actions: (
          <Button
            variant="glass"
            data-od-id="prj-create-open"
            onClick={() => setCreating(true)}
          >
            새 프로젝트
          </Button>
        ),
      }}
    >
      <FilterTabs
        className={projectFilterTabsStyles()}
        odId="prj-status-filter"
        label="프로젝트 상태"
        options={statuses}
        value={status}
        onValueChange={setStatus}
      />
      {query.isPending && <ListSkeleton label="프로젝트를 불러오고 있어요" />}
      {query.isError && (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      )}
      {projects &&
        (projects.length > 0 ? (
          <List variant="divided" data-od-id="prj-project-list">
            {projects.map((entry) => (
              <ProjectListRow key={entry.project.id} {...entry} today={today} />
            ))}
          </List>
        ) : (
          <div data-od-id="prj-project-empty">
            <EmptyState
              message={emptyMessages[status]}
              icon={<Briefcase size={36} />}
            />
          </div>
        ))}
      {creating && (
        <ProjectEditor
          onClose={() => setCreating(false)}
          savedPath={(id) => `/projects/${id}`}
        />
      )}
    </PageLayout>
  );
}
