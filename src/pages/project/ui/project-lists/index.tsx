"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type Ref } from "react";
import {
  candidateStatusLabels,
  projectCandidateEstimate,
  projectPhotoUrl,
  projectQuantitySource,
  projectTagCounts,
  useProject,
  useProjectWrite,
  type ProjectDetail,
  type ProjectListDefinition,
  type ProjectListItem,
  type ProjectListInput,
  type ProjectPhoto,
} from "@/entities/project";
import { ListEditor, ListItemEditor } from "@/features/project-edit";
import { ApiError } from "@/shared/api";
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageLayout,
  SectionHeader,
  StatusBadge,
  TextButton,
  useConfirm,
} from "@/shared/ui";
import ProjectBackLink from "../project-header";

const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const kindLabels = { candidates: "후보 목록", people: "명단" };
const tones = {
  candidate: "info",
  selected: "success",
  excluded: "info",
} as const;

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

function columnFacts(list: ProjectListDefinition, item: ProjectListItem) {
  return list.columns.flatMap(({ key, label, type }) => {
    const value = item.values[key];
    if (value === undefined) return [];
    return [
      {
        key,
        label,
        value:
          type === "money" && typeof value === "number" ? money(value) : value,
      },
    ];
  });
}

function PhotoGallery({
  projectId,
  photos,
  onDelete,
}: {
  projectId: string;
  photos: ProjectPhoto[];
  onDelete: (photo: ProjectPhoto) => void;
}) {
  return (
    <div data-od-id="prj-candidate-photo">
      {photos.length === 0 ? (
        <p className="grid min-h-25 place-items-center bg-muted text-muted-foreground">
          사진 미등록
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="min-w-0">
              <a
                href={projectPhotoUrl(projectId, photo.id)}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  unoptimized
                  src={projectPhotoUrl(projectId, photo.id, true)}
                  alt={`후보 사진 ${index + 1}`}
                  width={320}
                  height={320}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </a>
              <TextButton
                type="button"
                className="text-destructive"
                aria-label={`사진 ${index + 1} 삭제`}
                onClick={() => onDelete(photo)}
              >
                삭제
              </TextButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateDetail({
  list,
  item,
  photos,
  edit,
  removePhoto,
  sectionRef,
}: {
  list: ProjectListDefinition;
  item: ProjectListItem;
  photos: ProjectPhoto[];
  edit: () => void;
  removePhoto: (photo: ProjectPhoto) => void;
  sectionRef: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={sectionRef}
      className="my-4 space-y-3 pt-3"
      aria-label={`${item.title} 상세`}
    >
      <SectionHeader title={item.title} />
      <PhotoGallery
        projectId={list.project_id}
        photos={photos}
        onDelete={removePhoto}
      />
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-sm wrap-anywhere">
        {columnFacts(list, item).map(({ key, label, value }) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
        {item.memo && (
          <div className="contents">
            <dt className="text-muted-foreground">메모</dt>
            <dd className="text-right whitespace-pre-wrap">{item.memo}</dd>
          </div>
        )}
      </dl>
      {item.links.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 text-sm">
          {item.links.map((link, index) => (
            <li key={`${index}-${link}`}>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                링크 {index + 1} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <TextButton type="button" onClick={edit}>
        후보 수정
      </TextButton>
    </section>
  );
}

function CandidateRows({
  items,
  count,
  photos,
  selectedId,
  select,
}: {
  items: ProjectListItem[];
  count: number | null;
  photos: ProjectPhoto[];
  selectedId: string | undefined;
  select: (id: string) => void;
}) {
  return (
    <List data-od-id="prj-candidate-list" className="divide-y divide-border/45">
      {items.map((item) => {
        const estimate = projectCandidateEstimate(item.price, count);
        const hasPhoto = photos.some((photo) => photo.item_id === item.id);
        let price = "가격 미정";
        if (item.price !== null) {
          price = money(item.price);
          if (estimate !== null)
            price += ` × ${count}명 · 예상 ${money(estimate)}`;
        }
        const summary = [price, item.memo, hasPhoto ? "" : "사진 없음"]
          .filter(Boolean)
          .join(" · ");
        const selected = item.id === selectedId;
        return (
          <ListRow
            key={item.id}
            description={summary}
            className={selected ? "bg-accent-soft" : undefined}
            trailing={
              item.status && (
                <StatusBadge shape="capsule" variant={tones[item.status]}>
                  {candidateStatusLabels[item.status]}
                </StatusBadge>
              )
            }
          >
            <TextButton
              onClick={() => select(item.id)}
              aria-current={selected || undefined}
              className="h-auto p-0 text-left text-base font-semibold text-foreground"
            >
              {item.title}
            </TextButton>
          </ListRow>
        );
      })}
    </List>
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
  const checkId = useId();
  return (
    <>
      {list.tags.map(({ key, label }) => {
        const { total, done } = projectTagCounts(items, key);
        return (
          <div
            key={key}
            data-od-id="prj-people-tag-summary"
            className="flex items-center justify-between gap-2 border-b border-border/45 py-2 text-sm wrap-anywhere"
          >
            <strong>
              {label} · 대상 {total}명
            </strong>
            <span className="shrink-0 text-muted-foreground">
              완료 {done} / {total}
            </span>
          </div>
        );
      })}
      <List data-od-id="prj-people-list" className="divide-y divide-border/45">
        {items.map((item) => {
          const facts = columnFacts(list, item);
          return (
            <ListRow key={item.id}>
              <TextButton
                onClick={() => edit(item.id)}
                className="h-auto p-0 text-left text-base font-semibold text-foreground"
              >
                {item.title}
              </TextButton>
              {facts.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {facts
                    .map(({ label, value }) => `${label}: ${value}`)
                    .join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4">
                {list.tags
                  .filter(({ key }) => item.tags.includes(key))
                  .map(({ key, label }) => {
                    const id = `${checkId}-${item.id}-${key}`;
                    return (
                      <label
                        key={key}
                        htmlFor={id}
                        className="flex min-h-11 items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={id}
                          checked={item.done_tags.includes(key)}
                          disabled={pending}
                          aria-label={`${item.title} ${label} 완료`}
                          onCheckedChange={(checked) =>
                            setDone(item.id, key, checked === true)
                          }
                        />
                        {label} 완료
                      </label>
                    );
                  })}
              </div>
            </ListRow>
          );
        })}
      </List>
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
  const [selection, setSelection] = useState<string>();
  const detailRef = useRef<HTMLElement>(null);
  const write = useProjectWrite();
  const confirm = useConfirm();
  const candidate = list.kind === "candidates";
  const projectId = list.project_id;
  const listId = list.id;
  const items = data.listItems.filter((item) => item.list_id === listId);
  const source = candidate
    ? projectQuantitySource(list, data.lists, data.listItems)
    : null;
  const focused = items.find((item) => item.id === selection) ?? items[0];
  const editing = items.find((item) => item.id === editor);

  function selectCandidate(id: string) {
    setSelection(id);
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({ block: "start" }),
    );
  }

  async function removePhoto(photo: ProjectPhoto) {
    await confirm({
      title: "사진 삭제",
      description: "삭제한 사진은 되돌릴 수 없어요.",
      confirmLabel: "삭제",
      destructive: true,
      onConfirm: () =>
        write.mutateAsync({
          action: "delete_list_photo",
          projectId,
          listId,
          id: photo.item_id,
          photoId: photo.id,
        }),
    });
  }

  return (
    <PageLayout
      width="narrow"
      odId={candidate ? "prj-candidates" : "prj-people"}
      header={{
        title: list.name,
        subtitle: data.project.title,
        subtitleVariant: "context",
        navigation: (
          <ProjectBackLink
            href={`/projects/${projectId}/lists?kind=${list.kind}`}
            label={kindLabels[list.kind]}
          />
        ),
        actions: (
          <Button variant="glass" onClick={() => setEditor("")}>
            추가
          </Button>
        ),
      }}
    >
      {candidate ? (
        <>
          <div
            className="mb-3 flex flex-wrap items-center justify-between gap-x-2 text-sm"
            data-od-id="prj-quantity-source"
          >
            {source ? (
              <>
                <p>
                  수량 기준 ·{" "}
                  <strong>
                    {source.roster} → {source.tag} · {source.count}명
                  </strong>
                </p>
                <TextButton
                  disabled={write.isPending}
                  onClick={() =>
                    write.mutate({
                      action: "disconnect_list_quantity",
                      projectId,
                      id: listId,
                    })
                  }
                >
                  연결 해제
                </TextButton>
              </>
            ) : (
              <p>수량 기준 없음</p>
            )}
          </div>
          <CandidateRows
            items={items}
            count={source?.count ?? null}
            photos={data.photos}
            selectedId={focused?.id}
            select={selectCandidate}
          />
          {focused && (
            <CandidateDetail
              list={list}
              item={focused}
              photos={data.photos.filter(
                (photo) => photo.item_id === focused.id,
              )}
              edit={() => setEditor(focused.id)}
              removePhoto={(photo) => void removePhoto(photo)}
              sectionRef={detailRef}
            />
          )}
        </>
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
      {items.length === 0 && (
        <EmptyState
          message={candidate ? "아직 후보가 없어요." : "명단이 비어 있어요."}
        />
      )}
      {write.error && (
        <p role="alert" className="text-sm text-destructive">
          {write.error.message}
        </p>
      )}
      <TextButton onClick={() => setSettings(true)}>
        목록·사용자 정의 칸 설정
      </TextButton>
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
          onSaved={setSelection}
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
