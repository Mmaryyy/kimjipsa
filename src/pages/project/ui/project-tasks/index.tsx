"use client";
import { useState, type ComponentProps } from "react";
import { Search } from "lucide-react";
import {
  taskAssignees,
  taskStatuses,
  taskStatusLabels,
  TaskRow,
  type ProjectArea,
  useProject,
  useProjectWrite,
  type ProjectTask,
} from "@/entities/project";
import { TaskEditor } from "@/features/project-edit";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ErrorState,
  Input,
  List,
  ListSkeleton,
  PageLayout,
  Select,
} from "@/shared/ui";
import { getOptionLabel } from "@/shared/lib";
import { ApiError } from "@/shared/api";
import ProjectBackLink from "../project-header";
import { taskFilterStyles } from "./project-tasks.variants";

function TaskFilter({
  label,
  children,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="sr-only">{label}</span>
      <Select {...props} controlClassName={taskFilterStyles()}>
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
  ...props
}: ComponentProps<typeof List> & {
  tasks: ProjectTask[];
  areas: ProjectArea[];
  assignees: ReturnType<typeof taskAssignees>;
  pending: boolean;
  onEdit: (task: ProjectTask) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
}) {
  return (
    <List {...props}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          area={
            areas.find((entry) => entry.id === task.area_id)?.name ??
            "영역 없음"
          }
          assignee={getOptionLabel(taskAssigneeKey(task), assignees, "미정")}
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
  const [editor, setEditor] = useState<ProjectTask | "new">();
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
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
        header={{ title: "할 일", navigation }}
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
  const assignees = taskAssignees(members);
  const term = search.trim().toLocaleLowerCase();
  const visible = tasks.filter(
    (task) =>
      (!area || (task.area_id ?? "none") === area) &&
      (!status || task.status === status) &&
      (!assignee || taskAssigneeKey(task) === assignee) &&
      [task.title, task.memo, task.depends_note].some((text) =>
        text.toLocaleLowerCase().includes(term),
      ),
  );
  const incomplete = visible.filter((task) => task.status !== "done");
  const completed = visible
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

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
        subtitle: project.title,
        subtitleVariant: "context",
        navigation,
        actions: (
          <Button variant="glass" onClick={() => setEditor("new")}>
            추가
          </Button>
        ),
      }}
    >
      <div
        className="mt-2 mb-5 grid grid-cols-3 gap-2"
        data-od-id="prj-task-filters"
      >
        <Input
          className="col-span-3"
          variant="glass"
          type="search"
          data-od-id="prj-task-search"
          aria-label="할 일 검색"
          placeholder="할 일 검색"
          icon={<Search size={16} aria-hidden />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TaskFilter
          label="영역"
          value={area}
          onChange={(event) => setArea(event.target.value)}
        >
          <option value="">모든 영역</option>
          <option value="none">영역 없음</option>
          {areas.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </TaskFilter>
        <TaskFilter
          label="상태"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">모든 상태</option>
          {taskStatuses.map((value) => (
            <option key={value} value={value}>
              {taskStatusLabels[value]}
            </option>
          ))}
        </TaskFilter>
        <TaskFilter
          label="담당"
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
        >
          <option value="">모든 담당</option>
          {assignees.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </TaskFilter>
      </div>

      {write.isError && (
        <p role="alert" className="text-sm text-destructive">
          {write.error.message}
        </p>
      )}
      <TaskList
        data-od-id="prj-task-list"
        tasks={incomplete}
        {...taskListProps}
      />
      {completed.length > 0 && (
        <Accordion
          type="single"
          collapsible
          className="mt-10"
          data-od-id="prj-task-completed"
        >
          <AccordionItem value="completed" variant="plain">
            <AccordionTrigger heading="h2" tone="muted">
              <span>
                <span className="font-semibold">완료</span>({completed.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <TaskList tasks={completed} {...taskListProps} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {visible.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          조건에 맞는 할 일이 없어요.
        </p>
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
