"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  MilestoneTimeline,
  ProjectDeadline,
  ProjectProgressBar,
  ProjectProgressGauge,
  projectModuleLabels,
  projectModules,
  projectDeadlineDays,
  projectProgress,
  projectToday,
  taskAssignees,
  upcomingTasks,
  useProject,
  type ProjectTask,
} from "@/entities/project";
import {
  MilestoneEditor,
  ProjectEditor,
  ProjectEventAction,
} from "@/features/project-edit";
import {
  Button,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageLayout,
  SectionHeader,
  StatusBadge,
  TextButton,
} from "@/shared/ui";
import { ApiError } from "@/shared/api";
import ProjectBackLink from "../project-header";
import { projectOverviewButtonStyles } from "./project-overview.variants";

function AreaProgress({ name, tasks }: { name: string; tasks: ProjectTask[] }) {
  const { done, total, percent } = projectProgress(tasks);
  return (
    <ListRow
      className="border-b border-border/60 py-3 last:border-b-0"
      description={`${done} / ${total} 완료 · ${percent}%`}
      trailing={
        <ProjectProgressBar
          label={`${name} 진행률`}
          done={done}
          total={total}
          className="w-25"
        />
      }
    >
      <span className="font-semibold">{name}</span>
    </ListRow>
  );
}

function ProjectOverview({ id }: { id: string }) {
  const query = useProject(id);
  const [editor, setEditor] = useState<"project" | "milestone">();
  const close = () => setEditor(undefined);

  const unavailable =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  if (!query.data || unavailable)
    return (
      <PageLayout
        width="narrow"
        odId="prj-overview"
        header={{
          title: "프로젝트",
          navigation: (
            <ProjectBackLink href="/projects" label="프로젝트 목록" />
          ),
        }}
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

  const { project, areas, milestones, tasks, members } = query.data;
  const progress = projectProgress(tasks);
  const today = projectToday();
  const deadlines = upcomingTasks(tasks, today).slice(0, 5);
  const byArea = new Map<ProjectTask["area_id"], ProjectTask[]>();
  for (const task of tasks) {
    const areaTasks = byArea.get(task.area_id);
    if (areaTasks) areaTasks.push(task);
    else byArea.set(task.area_id, [task]);
  }
  const ungrouped = byArea.get(null);
  const assignees = taskAssignees(members);
  const modules = projectModules
    .filter((module) => project.modules.includes(module))
    .flatMap<{ label: string; href?: string }>((module) => {
      if (module === "lists")
        return [{ label: "후보 목록" }, { label: "명단" }];
      const label = projectModuleLabels[module];
      if (module === "budget") return [{ label }];
      return [{ label, href: `/projects/${id}/${module}` }];
    });

  return (
    <PageLayout
      width="narrow"
      odId="prj-overview"
      header={{
        title: project.title,
        navigation: <ProjectBackLink href="/projects" label="프로젝트 목록" />,
        actions: (
          <Button variant="glass" onClick={() => setEditor("project")}>
            설정
          </Button>
        ),
      }}
    >
      <div
        className="mt-5 flex flex-col items-center gap-2 py-2 text-center"
        data-od-id="prj-overview-progress"
      >
        <p className="text-sm text-muted-foreground" aria-hidden="true">
          전체 준비
        </p>
        <ProjectProgressGauge percent={progress.percent} />
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p>
            {project.target_on
              ? `${project.target_on.replaceAll("-", ".")}까지`
              : "목표일 미정"}
          </p>
        </div>
      </div>
      <section aria-labelledby="prj-timeline-title">
        <SectionHeader title="타임라인" id="prj-timeline-title" />
        <MilestoneTimeline
          milestones={milestones}
          areas={areas}
          today={today}
          action={(row) => <ProjectEventAction row={row} source="milestones" />}
        />
      </section>
      <section aria-labelledby="prj-area-progress-title">
        <SectionHeader title="영역별 진행률" id="prj-area-progress-title" />
        <List data-od-id="prj-area-progress">
          {areas.map((area) => (
            <AreaProgress
              key={area.id}
              name={area.name}
              tasks={byArea.get(area.id) ?? []}
            />
          ))}
          {ungrouped && <AreaProgress name="영역 없음" tasks={ungrouped} />}
        </List>
        {!areas.length && !ungrouped && (
          <p className="text-sm text-muted-foreground">아직 영역이 없어요.</p>
        )}
      </section>
      <section aria-labelledby="prj-deadlines-title">
        <SectionHeader title="다가오는 마감" id="prj-deadlines-title" />
        <List>
          {deadlines.map((task) => {
            if (!task.due_on) return null;
            const assigneeKey = task.assignee_id ?? task.assignee_kind;
            const assignee = assignees.find(
              (entry) =>
                entry.value === assigneeKey && assigneeKey !== "unassigned",
            )?.label;
            const days = projectDeadlineDays(task.due_on, today);
            return (
              <ListRow
                key={task.id}
                trailing={
                  <StatusBadge
                    shape="capsule"
                    variant={days <= 2 ? "warning" : "info"}
                  >
                    {days === 0 ? "오늘" : `D-${days}`}
                  </StatusBadge>
                }
              >
                <ProjectDeadline
                  date={task.due_on}
                  title={task.title}
                  assignee={assignee}
                />
              </ListRow>
            );
          })}
        </List>
        {!deadlines.length && (
          <p className="text-sm text-muted-foreground">
            다가오는 할 일 마감이 없어요.
          </p>
        )}
      </section>
      <section aria-labelledby="prj-modules-title">
        <SectionHeader title="구성 요소" id="prj-modules-title" />
        <List>
          <li className="border-b border-border/60">
            <Link
              href={`/projects/${id}/tasks`}
              className="flex min-h-11 items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-semibold text-primary">할 일</p>
                <p className="text-sm text-muted-foreground">
                  {progress.total - progress.done}개 남음
                </p>
              </div>
              <ChevronRight aria-hidden size={16} />
            </Link>
          </li>
          {modules.map(({ label, href }) => (
            <ListRow
              key={label}
              className="border-b border-border/60 text-muted-foreground"
            >
              {href ? (
                <Link
                  href={href}
                  className="flex min-h-11 items-center justify-between gap-3 font-semibold text-primary"
                >
                  {label}
                  <ChevronRight aria-hidden size={16} />
                </Link>
              ) : (
                label
              )}
            </ListRow>
          ))}
          <li>
            <TextButton
              asChild
              size={null}
              className={projectOverviewButtonStyles()}
            >
              <Link href={`/projects/${id}/areas`}>
                영역 설정
                <ChevronRight
                  aria-hidden
                  size={16}
                  className="text-foreground"
                />
              </Link>
            </TextButton>
          </li>
          <li>
            <TextButton
              size={null}
              className={projectOverviewButtonStyles()}
              onClick={() => setEditor("milestone")}
            >
              마일스톤 설정
              <ChevronRight aria-hidden size={16} className="text-foreground" />
            </TextButton>
          </li>
        </List>
      </section>

      {editor === "project" && (
        <ProjectEditor
          project={project}
          onClose={close}
          deletedPath="/projects"
        />
      )}
      {editor === "milestone" && (
        <MilestoneEditor
          projectId={id}
          areas={areas}
          milestones={milestones}
          onClose={close}
        />
      )}
    </PageLayout>
  );
}

export default ProjectOverview;
