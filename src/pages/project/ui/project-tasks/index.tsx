"use client";
import { useState, type ComponentProps } from "react";
import { Search } from "lucide-react";
import {
  projectDeadlineDays,
  projectToday,
  taskAssignees,
  taskStatuses,
  taskStatusLabels,
  type ProjectArea,
  useProject,
  useProjectWrite,
  type ProjectTask,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { TaskEditor } from "@/features/project-edit";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ErrorState,
  FilterTabs,
  GroupLabel,
  Input,
  List,
  ListSkeleton,
  PageLayout,
  Select,
} from "@/shared/ui";
import { getOptionLabel } from "@/shared/lib";
import { ApiError } from "@/shared/api";
import ProjectBackLink from "../project-header";
import TaskRow from "./TaskRow";
import {
  taskAssigneeTabsStyles,
  taskFilterStyles,
  taskWarningDot,
} from "./project-tasks.variants";

type DatedTask = { task: ProjectTask; days: number | null };

const taskGroups = [
  {
    label: "늦어진 일",
    matches: (days: number | null) => days !== null && days < 0,
  },
  {
    label: "이번 주",
    matches: (days: number | null) => days !== null && days >= 0 && days <= 7,
  },
  {
    label: "그다음",
    matches: (days: number | null) => days !== null && days > 7,
  },
  { label: "날짜 없음", matches: (days: number | null) => days === null },
];

function TaskFilter({
  label,
  children,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  return (
    <label className="flex min-w-0 items-center gap-1 whitespace-nowrap text-caption text-muted-foreground">
      {label}
      <Select
        {...props}
        variant="inline"
        className="min-w-0 [&>svg]:right-0 [&>svg]:size-3"
        controlClassName={taskFilterStyles()}
      >
        {children}
      </Select>
    </label>
  );
}

function taskAssigneeKey(task: ProjectTask) {
  return task.assignee_id ?? task.assignee_kind;
}

function TaskList({
  tasks,
  areas,
  assignees,
  pending,
  onEdit,
  onToggleTask,
}: {
  tasks: DatedTask[];
  areas: ProjectArea[];
  assignees: ReturnType<typeof taskAssignees>;
  pending: boolean;
  onEdit: (task: ProjectTask) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
}) {
  return (
    <List variant="divided">
      {tasks.map(({ task, days }) => (
        <TaskRow
          key={task.id}
          task={task}
          days={days}
          area={
            areas.find((entry) => entry.id === task.area_id)?.name ??
            "영역 없음"
          }
          assignee={getOptionLabel(
            taskAssigneeKey(task),
            assignees,
            "탈퇴한 구성원",
          )}
          pending={pending}
          onEdit={() => onEdit(task)}
          onToggle={(done) => onToggleTask(task.id, done)}
        />
      ))}
    </List>
  );
}

function ProjectTasks({ id }: { id: string }) {
  const query = useProject(id);
  const write = useProjectWrite();
  const { data: account } = useAccount();
  const [editor, setEditor] = useState<ProjectTask | "new">();
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [search, setSearch] = useState("");
  const navigation = (
    <ProjectBackLink href={`/projects/${id}`} label="프로젝트 개요" />
  );

  const unavailable =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  if (!query.data || unavailable)
    return (
      <PageLayout
        width="narrow"
        odId="prj-tasks"
        header={{ title: "할 일", titleOdId: "prj-tasks-title", navigation }}
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

  const { project, areas, tasks, members } = query.data;
  const assignees = taskAssignees(members).map((option) =>
    option.value === "unassigned" ? { ...option, label: "담당 미정" } : option,
  );
  const assigneeTabs = [
    { value: "all", label: "전체" },
    { value: "mine", label: "내 일" },
    ...assignees.filter(
      ({ value }) => value !== "unassigned" && value !== account?.userId,
    ),
    { value: "unassigned", label: "담당 미정" },
  ];
  const matchesAssignee = (task: ProjectTask) => {
    if (assignee === "all") return true;
    if (assignee === "mine")
      return (
        task.assignee_kind === "together" ||
        task.assignee_id === account?.userId
      );
    return taskAssigneeKey(task) === assignee;
  };
  const term = search.trim().toLocaleLowerCase();
  const visible = tasks.filter(
    (task) =>
      (!area || (task.area_id ?? "none") === area) &&
      (!status || task.status === status) &&
      matchesAssignee(task) &&
      [task.title, task.memo, task.depends_note].some((text) =>
        text.toLocaleLowerCase().includes(term),
      ),
  );
  const today = projectToday();
  const incomplete = visible
    .filter((task) => task.status !== "done")
    .sort((a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9"))
    .map((task) => ({
      task,
      days: task.due_on ? projectDeadlineDays(task.due_on, today) : null,
    }));
  const completed = visible
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((task) => ({ task, days: null }));

  const taskListProps = {
    areas,
    assignees,
    pending: write.isPending,
    onEdit: setEditor,
    onToggleTask: (taskId: string, done: boolean) =>
      write.mutate({
        action: "set_task_done",
        projectId: id,
        id: taskId,
        done,
      }),
  };

  return (
    <PageLayout
      width="narrow"
      odId="prj-tasks"
      header={{
        title: "할 일",
        titleOdId: "prj-tasks-title",
        subtitle: project.title,
        subtitleVariant: "context",
        navigation,
        actions: (
          <Button
            variant="glass"
            data-od-id="prj-task-add"
            onClick={() => setEditor("new")}
          >
            추가
          </Button>
        ),
      }}
    >
      <div className="mt-1" data-od-id="prj-task-filters">
        <Input
          variant="glass"
          type="search"
          data-od-id="prj-task-search"
          aria-label="할 일 검색"
          placeholder="할 일 검색"
          icon={<Search size={16} aria-hidden />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterTabs
          label="담당"
          className={taskAssigneeTabsStyles}
          options={assigneeTabs}
          value={assignee}
          onValueChange={setAssignee}
        />
        <div className="flex items-center gap-4">
          <TaskFilter
            label="영역"
            value={area}
            onChange={(event) => setArea(event.target.value)}
          >
            <option value="">전체</option>
            {areas.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
            <option value="none">영역 없음</option>
          </TaskFilter>
          <TaskFilter
            label="상태"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">전체</option>
            {taskStatuses.map((value) => (
              <option key={value} value={value}>
                {taskStatusLabels[value]}
              </option>
            ))}
          </TaskFilter>
        </div>
      </div>

      {write.isError && (
        <p role="alert" className="text-sm text-destructive">
          {write.error.message}
        </p>
      )}
      <div data-od-id="prj-task-list">
        {taskGroups.map(({ label, matches }, index) => {
          const group = incomplete.filter(({ days }) => matches(days));
          if (group.length === 0) return null;
          return (
            <section
              key={label}
              aria-labelledby={`prj-task-group-title-${index}`}
              data-od-id={`prj-task-group-${index}`}
            >
              <GroupLabel
                id={`prj-task-group-title-${index}`}
                className={
                  index === 0
                    ? "flex items-center gap-1.5 text-foreground"
                    : undefined
                }
              >
                {index === 0 && <span aria-hidden className={taskWarningDot} />}
                <span>
                  {label} <span className="tabular-nums">{group.length}</span>
                </span>
              </GroupLabel>
              <TaskList tasks={group} {...taskListProps} />
            </section>
          );
        })}
        {incomplete.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            {visible.length
              ? "남은 할 일이 없어요."
              : "조건에 맞는 할 일이 없어요."}
          </p>
        )}
      </div>
      {completed.length > 0 && (
        <Accordion
          type="single"
          collapsible
          className="mt-5"
          data-od-id="prj-task-done"
        >
          <AccordionItem value="completed" variant="plain">
            <AccordionTrigger
              heading="h2"
              tone="muted"
              className="text-label font-semibold"
            >
              완료 <span className="tabular-nums">{completed.length}</span>
            </AccordionTrigger>
            <AccordionContent>
              <TaskList tasks={completed} {...taskListProps} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {editor && (
        <TaskEditor
          projectId={id}
          areas={areas}
          members={members}
          task={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
        />
      )}
    </PageLayout>
  );
}

export default ProjectTasks;
