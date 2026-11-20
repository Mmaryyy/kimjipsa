"use client";
import { useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import {
  ProjectDeadline,
  ProjectProgressBar,
  projectPeriod,
  projectStatuses,
  projectStatusLabels,
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
import { projectFilterTabsStyles } from "./projects-page.variants";

const statuses = projectStatuses.map((value) => ({
  value,
  label: projectStatusLabels[value],
}));

const projectStatusVariants = {
  active: "progress",
  completed: "success",
  archived: "neutral",
} as const;

function ProjectListRow({ project, progress, next }: ProjectListEntry) {
  const period = projectPeriod(
    project.starts_on,
    project.target_on,
    "기간 미정",
  );
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link href={`/projects/${project.id}`} className="block py-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {period}
              {project.starts_on && !project.target_on && " · 목표일 미정"}
            </p>
            <Text as="h2" variant="title-sm" className="mt-1 wrap-anywhere">
              {project.title}
            </Text>
          </div>
          {progress.total === 0 && (
            <StatusBadge
              shape="capsule"
              variant={projectStatusVariants[project.status]}
            >
              {projectStatusLabels[project.status]}
            </StatusBadge>
          )}
          <ChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        </div>
        {progress.total > 0 && (
          <div className="mt-4">
            <p className="flex justify-between gap-2 text-sm text-muted-foreground">
              <span>
                할 일 {progress.done} / {progress.total} 완료
              </span>
              <span>{progress.percent}%</span>
            </p>
            <ProjectProgressBar
              done={progress.done}
              total={progress.total}
              label={`${project.title} 진행률`}
              className="mt-3 w-full"
            />
          </div>
        )}
        {next?.due_on && (
          <p className="mt-2">
            <span className="sr-only">다음 마감</span>
            <ProjectDeadline date={next.due_on} title={next.title} />
          </p>
        )}
      </Link>
    </li>
  );
}

export default function ProjectsPage() {
  const query = useProjects();
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
          <List data-od-id="prj-project-list">
            {projects.map((entry) => (
              <ProjectListRow key={entry.project.id} {...entry} />
            ))}
          </List>
        ) : (
          <div data-od-id="prj-project-empty">
            <EmptyState
              message="아직 이 상태의 프로젝트가 없어요."
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
