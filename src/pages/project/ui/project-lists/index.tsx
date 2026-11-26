"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ProjectProgressBar,
  projectTagCounts,
  useProject,
  useProjectWrite,
  type ProjectDetail,
  type ProjectListDefinition,
  type ProjectListItem,
  type ProjectListInput,
} from "@/entities/project";
import { ListEditor, ListItemEditor } from "@/features/project-edit";
import { ApiError } from "@/shared/api";
import { cn } from "@/shared/lib";
import {
  Button,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageLayout,
  TextButton,
} from "@/shared/ui";
import CandidateList from "./CandidateList";
import ProjectBackLink from "../project-header";

const kindLabels = { candidates: "후보 목록", people: "명단" };
function ListIndex({
  kind,
  data,
}: {
  kind: ProjectListInput["kind"];
  data: ProjectDetail;
}) {
  const [editing, setEditing] = useState(false);
  const projectId = data.project.id;
  const lists = data.lists.filter((list) => list.kind === kind);
  return (
    <PageLayout
      width="narrow"
      header={{
        title: kindLabels[kind],
        subtitle: data.project.title,
        subtitleVariant: "context",
        navigation: (
          <ProjectBackLink
            href={`/projects/${projectId}`}
            label="프로젝트 개요"
          />
        ),
        actions: (
          <Button variant="glass" onClick={() => setEditing(true)}>
            추가
          </Button>
        ),
      }}
    >
      {lists.length === 0 && <EmptyState message="아직 만든 목록이 없어요." />}
      <List className="divide-y divide-border/45">
        {lists.map((list) => (
          <ListRow key={list.id}>
            <Link
              href={`/projects/${projectId}/lists/${list.id}`}
              className="flex min-h-11 items-center justify-between gap-2"
            >
              <span className="font-semibold">{list.name}</span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </ListRow>
        ))}
      </List>
      {editing && (
        <ListEditor
          projectId={projectId}
          kind={kind}
          lists={data.lists}
          onClose={() => setEditing(false)}
        />
      )}
    </PageLayout>
  );
}

function PeopleSummary({
  tags,
  items,
}: {
  tags: ProjectListDefinition["tags"];
  items: ProjectListItem[];
}) {
  return (
    <section
      aria-label="태그별 진행"
      data-od-id="prj-people-summary"
      className="mt-4 rounded-control bg-fill-quaternary p-4"
    >
      <p className="text-caption-sm text-muted-foreground tabular-nums">
        {items.length}명
      </p>
      {tags.length > 0 && (
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {tags.map(({ key, label }) => {
            const { total, done } = projectTagCounts(items, key);
            return (
              <li
                key={key}
                className="grid min-h-18 content-center gap-0.5 rounded-control bg-background px-3 py-2"
              >
                <span
                  className="truncate text-caption-sm font-medium text-muted-foreground"
                  title={label}
                >
                  {label}
                </span>
                <span className="text-headline font-semibold tabular-nums">
                  {done}
                  <span className="text-caption font-normal text-muted-foreground">
                    {" / "}
                    {total}
                  </span>
                </span>
                <ProjectProgressBar
                  label={`${label} ${total}명 중 ${done}명 완료`}
                  done={done}
                  total={total}
                  className={cn(
                    "mt-1 h-1 w-full overflow-hidden rounded-[var(--r-bar)] bg-[var(--fill-tertiary)]",
                    "[&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-success",
                    "[&::-moz-progress-bar]:bg-success",
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PeopleRows({
  list,
  items,
  edit,
  setDone,
  pending,
}: {
  list: ProjectListDefinition;
  items: ProjectListItem[];
  edit: (id: string) => void;
  setDone: (itemId: string, key: string, done: boolean) => void;
  pending: boolean;
}) {
  const [tagFilter, setTagFilter] = useState("");
  const { tags } = list;
  const activeTag = tags.find(({ key }) => key === tagFilter)?.key ?? "";
  const visibleItems = activeTag
    ? items.filter((item) => item.tags.includes(activeTag))
    : items;
  const relationshipKey = list.columns.find(
    ({ label }) => label === "관계",
  )?.key;
  const columns = ["minmax(5.5rem,1fr)", ...tags.map(() => "max-content")];

  return (
    <>
      <PeopleSummary tags={tags} items={items} />
      <div
        role="group"
        aria-label="태그로 보기"
        className="mt-3 flex flex-wrap gap-x-2 gap-y-3 py-2"
      >
        {[{ key: "", label: "모두" }, ...tags].map(({ key, label }) => (
          <Button
            key={key}
            variant="gray"
            size="sm"
            aria-pressed={key === activeTag}
            className={cn(
              "h-8 min-w-11 max-w-full rounded-full px-3 font-medium",
              "bg-[var(--fill-tertiary)] text-muted-foreground",
              "aria-pressed:bg-foreground aria-pressed:text-background",
            )}
            onClick={() => setTagFilter(key)}
          >
            <span className="truncate" title={label}>
              {label}
            </span>
          </Button>
        ))}
      </div>
      {visibleItems.length === 0 ? (
        <EmptyState
          layout="row"
          icon={null}
          message={
            activeTag ? "이 태그가 붙은 사람이 없어요." : "명단이 비어 있어요."
          }
        />
      ) : (
        <div className="mt-1 overflow-x-auto">
          <List
            variant="divided"
            data-od-id="prj-people-list"
            className="grid gap-x-1"
            style={{ gridTemplateColumns: columns.join(" ") }}
          >
            {visibleItems.map((item) => {
              const relationship = relationshipKey
                ? item.values[relationshipKey]
                : undefined;
              return (
                <li
                  key={item.id}
                  data-od-id={`prj-person-${item.id}`}
                  className="col-span-full grid min-h-13 grid-cols-subgrid items-center"
                >
                  <TextButton
                    size="touch"
                    tone="neutral"
                    aria-haspopup="dialog"
                    onClick={() => edit(item.id)}
                    className="min-w-0 justify-start gap-1.5 text-left"
                  >
                    <span
                      className="truncate text-body font-semibold"
                      title={item.title}
                    >
                      {item.title}
                    </span>
                    {relationship !== undefined && (
                      <span className="max-w-2/5 shrink-0 truncate text-caption text-muted-foreground">
                        {relationship}
                      </span>
                    )}
                  </TextButton>
                  {tags.map(({ key, label }) => {
                    const assigned = item.tags.includes(key);
                    const done = assigned && item.done_tags.includes(key);
                    return (
                      <Button
                        key={key}
                        variant="gray"
                        size="sm"
                        aria-pressed={assigned ? done : undefined}
                        aria-label={`${item.title} ${label}${assigned ? "" : " 대상 아님"}`}
                        disabled={!assigned || pending}
                        onClick={() => setDone(item.id, key, !done)}
                        className={cn(
                          "h-7 min-w-11 max-w-20 rounded-control px-2 text-caption-sm font-medium",
                          "bg-[var(--fill-tertiary)] aria-pressed:bg-success-soft aria-pressed:text-success-text",
                          !assigned &&
                            "bg-transparent text-label-quaternary ring-1 ring-border ring-inset disabled:opacity-100",
                        )}
                      >
                        {done && (
                          <Check size={12} className="shrink-0" aria-hidden />
                        )}
                        <span className="truncate" title={label}>
                          {label}
                        </span>
                      </Button>
                    );
                  })}
                </li>
              );
            })}
          </List>
        </div>
      )}
    </>
  );
}

function ListDetail({
  list,
  data,
}: {
  list: ProjectListDefinition;
  data: ProjectDetail;
}) {
  const [settings, setSettings] = useState(false);
  const [editor, setEditor] = useState<string>();
  const write = useProjectWrite();
  const candidate = list.kind === "candidates";
  const projectId = list.project_id;
  const listId = list.id;
  const items = data.listItems.filter((item) => item.list_id === listId);
  const editing = items.find((item) => item.id === editor);

  return (
    <PageLayout
      width="narrow"
      odId={candidate ? "prj-candidates" : "prj-people"}
      header={{
        title: list.name,
        subtitle: data.project.title,
        subtitleVariant: candidate ? "context-muted" : "context",
        navigation: (
          <ProjectBackLink
            href={`/projects/${projectId}/lists?kind=${list.kind}`}
            label={kindLabels[list.kind]}
          />
        ),
        titleOdId: candidate ? "prj-candidates-title" : "prj-lists-title",
        actions: (
          <>
            <Button
              variant="glass"
              data-od-id={candidate ? undefined : "prj-list-add"}
              onClick={() => setEditor("")}
            >
              추가
            </Button>
            <Button
              variant="glass"
              aria-haspopup="dialog"
              data-od-id="prj-list-settings"
              onClick={() => setSettings(true)}
            >
              설정
            </Button>
          </>
        ),
      }}
    >
      {candidate ? (
        <CandidateList list={list} data={data} onEdit={setEditor} />
      ) : (
        <PeopleRows
          list={list}
          items={items}
          edit={setEditor}
          pending={write.isPending}
          setDone={(id, tagKey, done) =>
            write.mutate({
              action: "set_list_tag_done",
              projectId,
              listId,
              id,
              tagKey,
              done,
            })
          }
        />
      )}
      {write.error && (
        <p role="alert" className="text-sm text-destructive">
          {write.error.message}
        </p>
      )}
      {settings && (
        <ListEditor
          projectId={projectId}
          list={list}
          kind={list.kind}
          lists={data.lists}
          onClose={() => setSettings(false)}
        />
      )}
      {editor !== undefined && (editor === "" || editing) && (
        <ListItemEditor
          key={editor}
          list={list}
          item={editing}
          onClose={() => setEditor(undefined)}
        />
      )}
    </PageLayout>
  );
}

function ProjectLists({
  id,
  kind = "candidates",
  listId,
}: {
  id: string;
  kind?: ProjectListInput["kind"];
  listId?: string;
}) {
  const query = useProject(id);
  const forbidden =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const data =
    !forbidden && query.data?.project.modules.includes("lists")
      ? query.data
      : undefined;

  if (data) {
    if (!listId) return <ListIndex data={data} kind={kind} />;
    const list = data.lists.find((entry) => entry.id === listId);
    if (list) return <ListDetail key={listId} data={data} list={list} />;
  }
  return (
    <PageLayout
      width="narrow"
      header={{
        title: listId ? "목록" : kindLabels[kind],
        navigation: (
          <ProjectBackLink href={`/projects/${id}`} label="프로젝트 개요" />
        ),
      }}
    >
      {query.isPending && <ListSkeleton />}
      {query.error && (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      )}
      {!query.isPending && !query.error && (
        <EmptyState
          message={
            data ? "목록을 찾을 수 없어요." : "이 구성 요소가 꺼져 있어요."
          }
        />
      )}
    </PageLayout>
  );
}

export default ProjectLists;
