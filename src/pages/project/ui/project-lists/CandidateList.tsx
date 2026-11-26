"use client";

import { ImageOff, Link2, ThumbsDown, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  candidateStatusLabels,
  projectCandidates,
  projectCandidateSummary,
  projectPhotoUrl,
  useProjectWrite,
  type CandidateVote,
  type ProjectDetail,
  type ProjectListDefinition,
  type ProjectListItem,
  type ProjectMember,
  type ProjectPhoto,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { cn, formatAmount, type AmountFormat } from "@/shared/lib";
import {
  Button,
  Checkbox,
  EmptyState,
  Sheet,
  StatusBadge,
  TextButton,
  useConfirm,
} from "@/shared/ui";

type CandidateData = ReturnType<typeof projectCandidates>;
type Candidate = CandidateData["candidates"][number] & {
  photos: ProjectPhoto[];
};
type Vote = CandidateVote["vote"];

const voteIcons = { up: ThumbsUp, down: ThumbsDown };
const voteLabels = { up: "선택에 찬성", down: "제외에 찬성" };
const tones = {
  candidate: "neutral",
  selected: "success",
  excluded: "neutral",
} as const;

function VoteRead({
  votes,
  members,
}: {
  votes: CandidateVote[];
  members: ProjectMember[];
}) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-caption-sm text-muted-foreground">
      {members.map(({ user_id, display_name }) => {
        const vote = votes.find((entry) => entry.user_id === user_id)?.vote;
        const Icon = vote && voteIcons[vote];
        return (
          <span key={user_id} className="inline-flex items-center gap-1">
            {Icon && (
              <Icon
                size={12}
                aria-hidden
                className={
                  vote === "up" ? "text-success-text" : "text-warning-text"
                }
              />
            )}
            <span>{display_name}</span>
            {vote ? (
              <span className="sr-only">{voteLabels[vote]}</span>
            ) : (
              <span>–</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function CandidateStatus({ status }: { status: Candidate["status"] }) {
  return (
    <StatusBadge
      variant={tones[status]}
      shape="capsule"
      className="h-4.5 px-1.5 text-caption-xs"
    >
      {candidateStatusLabels[status]}
    </StatusBadge>
  );
}

function CandidateSummary({
  candidates,
  source,
  assigned,
  amountFormat,
}: {
  candidates: Candidate[];
  source: CandidateData["source"];
  assigned: number;
  amountFormat: AmountFormat;
}) {
  const { selected, estimate } = projectCandidateSummary(candidates);
  const total = estimate ?? 0;
  const missing = source ? source.count - assigned : 0;
  return (
    <section
      aria-label="예상 총액"
      data-od-id="prj-quantity-source"
      className="mt-4 rounded-control bg-fill-quaternary p-4"
    >
      <p className="text-caption-sm text-muted-foreground">
        선택한 후보 {selected}개 기준 예상 총액
      </p>
      <p
        className={cn(
          "text-[length:var(--type-display-size)] leading-[var(--type-display-lh)]",
          "tracking-[var(--type-display-tracking)] font-bold tabular-nums wrap-anywhere",
        )}
      >
        {amountFormat === "won" ? (
          <>
            {formatAmount(total, "number")}
            <span className="ml-1 text-headline font-semibold">원</span>
          </>
        ) : (
          formatAmount(total, amountFormat)
        )}
      </p>
      <p className="mt-1 text-caption text-muted-foreground tabular-nums">
        {source
          ? `${source.roster} › ${source.tag} ${source.count}명 중 ${assigned}명 배정`
          : "수량 기준 없음"}
      </p>
      {missing > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-caption tabular-nums">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          아직 정하지 않은 사람 {missing}명
        </p>
      )}
    </section>
  );
}

function CandidateRow({
  candidate,
  projectId,
  members,
  amountFormat,
  onSelect,
}: {
  candidate: Candidate;
  projectId: string;
  members: ProjectMember[];
  amountFormat: AmountFormat;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { item, photos, status, people, votes, total } = candidate;
  const [firstPerson] = people;
  const excluded = status === "excluded";
  const thumbnail = photos[0];
  const extra = people.length > 1 ? ` 외 ${people.length - 1}명` : "";
  const recipientLabel = firstPerson ? `${firstPerson.title}${extra}` : "없음";
  return (
    <TextButton
      tone="neutral"
      aria-haspopup="dialog"
      data-od-id={`prj-candidate-${item.id}`}
      onClick={(event) => onSelect(event.currentTarget)}
      className="col-span-full grid min-h-16 w-full grid-cols-subgrid items-center gap-x-[normal] py-2 text-left"
    >
      {thumbnail ? (
        <Image
          unoptimized
          src={projectPhotoUrl(projectId, thumbnail.id, true)}
          alt=""
          width={44}
          height={44}
          className={cn(
            "size-11 rounded-control object-cover",
            excluded && "opacity-50",
          )}
        />
      ) : (
        <span
          className="grid size-11 place-items-center rounded-control bg-fill-tertiary text-label-tertiary"
          aria-hidden
        >
          <ImageOff size={18} />
        </span>
      )}
      <span className="min-w-0">
        {status !== "candidate" && <CandidateStatus status={status} />}
        <span
          className={cn(
            "block truncate text-headline font-semibold",
            excluded && "text-label-done",
          )}
        >
          {item.title}
        </span>
        <span className="mt-0.5 grid gap-0.5 text-caption-sm text-muted-foreground">
          <span className="truncate">받는 사람 {recipientLabel}</span>
          <VoteRead votes={votes} members={members} />
        </span>
      </span>
      <span className="text-right text-caption text-muted-foreground tabular-nums wrap-anywhere">
        <span className="sr-only">단가 </span>
        {item.price === null
          ? "가격 미정"
          : formatAmount(item.price, amountFormat)}
      </span>
      <span
        className={cn(
          "text-right text-body font-medium tabular-nums wrap-anywhere",
          excluded && "text-label-done",
          total === null && "text-label-tertiary",
        )}
      >
        <span className="sr-only">총 금액 </span>
        {total === null ? "—" : formatAmount(total, amountFormat)}
      </span>
    </TextButton>
  );
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
  if (!photos.length) return null;
  return (
    <ul data-od-id="prj-candidate-photo" className="grid grid-cols-2 gap-2">
      {photos.map((photo, index) => (
        <li key={photo.id} className="min-w-0 first:col-span-full">
          <a
            href={projectPhotoUrl(projectId, photo.id)}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              unoptimized
              src={projectPhotoUrl(projectId, photo.id, index !== 0)}
              alt={`후보 사진 ${index + 1}`}
              width={480}
              height={270}
              className="aspect-video w-full rounded-control object-cover"
            />
          </a>
          <TextButton tone="muted" size="touch" onClick={() => onDelete(photo)}>
            사진 삭제
          </TextButton>
        </li>
      ))}
    </ul>
  );
}

function CandidateDetail({
  amountFormat,
  candidate,
  list,
  people,
  assignedTo,
  viewerId,
  members,
  onEdit,
  onClose,
  restoreFocus,
}: {
  amountFormat: AmountFormat;
  candidate: Candidate;
  list: ProjectListDefinition;
  people: ProjectListItem[];
  assignedTo: Map<string, ProjectListItem | undefined>;
  viewerId?: string | null;
  members: ProjectMember[];
  onEdit: () => void;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const { item, photos, status, votes, total } = candidate;
  const write = useProjectWrite();
  const confirm = useConfirm();
  const ids = { projectId: list.project_id, listId: list.id, id: item.id };
  const myVote = votes.find(({ user_id }) => user_id === viewerId)?.vote;
  const otherMembers = members.filter(({ user_id }) => user_id !== viewerId);

  async function removePhoto(photo: ProjectPhoto) {
    await confirm({
      title: "사진 삭제",
      description: "삭제한 사진은 되돌릴 수 없어요.",
      confirmLabel: "삭제",
      destructive: true,
      onConfirm: () =>
        write.mutateAsync({
          action: "delete_list_photo",
          ...ids,
          photoId: photo.id,
        }),
    });
  }

  function changeStatus(nextStatus: Candidate["status"]) {
    write.mutate(
      { action: "set_candidate_status", ...ids, status: nextStatus },
      { onSuccess: onClose },
    );
  }

  function voteButton(vote: Vote) {
    const Icon = voteIcons[vote];
    const pressed = myVote === vote;
    return (
      <Button
        key={vote}
        size="icon-sm"
        variant="gray"
        aria-label={voteLabels[vote]}
        aria-pressed={pressed}
        disabled={write.isPending}
        className={cn(
          pressed && vote === "up" && "bg-success-soft text-success-text",
          pressed && vote === "down" && "bg-warning-soft text-warning-text",
        )}
        onClick={() =>
          write.mutate({
            action: "set_candidate_vote",
            ...ids,
            vote: pressed ? null : vote,
          })
        }
      >
        <Icon size={16} aria-hidden />
      </Button>
    );
  }

  const fields = list.columns.map(({ key, label, type }) => {
    const value = item.values[key];
    return {
      label,
      key,
      value:
        type === "money" && typeof value === "number"
          ? formatAmount(value, amountFormat)
          : value,
    };
  });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      title={item.title}
      description="받을 사람, 투표와 후보 정보"
      odId="prj-candidate-detail"
      action={<TextButton onClick={onEdit}>수정</TextButton>}
    >
      <div className="space-y-3">
        <PhotoGallery
          projectId={ids.projectId}
          photos={photos}
          onDelete={(photo) => void removePhoto(photo)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CandidateStatus status={status} />
          <VoteRead votes={votes} members={otherMembers} />
          {viewerId && (
            <div
              role="group"
              aria-label="내 투표"
              className="ml-auto flex items-center gap-2"
            >
              {voteButton("up")}
              {voteButton("down")}
            </div>
          )}
        </div>
        <dl
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] text-body wrap-anywhere",
            "[&_:is(dt,dd)]:flex [&_:is(dt,dd)]:min-h-11 [&_:is(dt,dd)]:items-center",
            "[&_:is(dt,dd)]:border-b [&_:is(dt,dd)]:border-border [&_dd]:justify-end [&_dd]:pl-3",
          )}
        >
          <dt className="py-2 text-muted-foreground">단가</dt>
          <dd className="text-right tabular-nums">
            {item.price === null
              ? "가격 미정"
              : formatAmount(item.price, amountFormat)}
          </dd>
          <dt className="py-2 text-muted-foreground">총 금액</dt>
          <dd className="text-right tabular-nums">
            {total === null ? (
              <span className="text-label-tertiary">—</span>
            ) : (
              <span>
                {formatAmount(total, amountFormat)}
                <span className="ml-1 text-caption text-muted-foreground">
                  ({candidate.people.length}명)
                </span>
              </span>
            )}
          </dd>
          {fields.map(({ label, key, value }) => (
            <div key={key} className="contents">
              <dt className="py-2 text-muted-foreground">{label}</dt>
              <dd className="text-right whitespace-pre-wrap tabular-nums">
                {value ?? "—"}
              </dd>
            </div>
          ))}
          <dt className="py-2 text-muted-foreground">메모</dt>
          <dd className="text-right whitespace-pre-wrap">{item.memo || "—"}</dd>
          <dt className="py-2 text-muted-foreground">링크</dt>
          <dd className="flex flex-wrap justify-end gap-x-3">
            {item.links.length === 0 && "—"}
            {item.links.map((link, index) => (
              <TextButton asChild size="sm" key={`${index}-${link}`}>
                <a href={link} target="_blank" rel="noreferrer">
                  <Link2 size={14} aria-hidden />
                  {new URL(link).hostname.replace(/^www\./, "")}
                </a>
              </TextButton>
            ))}
          </dd>
        </dl>
        <fieldset>
          <legend className="text-caption font-medium text-muted-foreground">
            받을 사람 · {candidate.people.length}명
          </legend>
          {people.length === 0 && (
            <p className="py-2 text-caption text-muted-foreground">
              받을 사람 없음
            </p>
          )}
          {people.map((person) => {
            const other = assignedTo.get(person.id);
            const checked = other?.id === item.id;
            const controlId = `candidate-${item.id}-person-${person.id}`;
            return (
              <div key={person.id} className="flex items-center gap-3">
                <Checkbox
                  id={controlId}
                  checked={checked}
                  disabled={write.isPending}
                  onCheckedChange={(value) =>
                    write.mutate({
                      action: "set_candidate_recipient",
                      ...ids,
                      personId: person.id,
                      assigned: value === true,
                    })
                  }
                />
                <label
                  htmlFor={controlId}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2"
                >
                  <span>{person.title}</span>
                  {other && !checked && (
                    <span className="ml-auto text-right text-caption text-muted-foreground">
                      {other.title}에 배정됨
                    </span>
                  )}
                </label>
              </div>
            );
          })}
        </fieldset>
        {write.error && (
          <p role="alert" className="text-caption text-destructive">
            {write.error.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="gray"
            disabled={write.isPending}
            onClick={() =>
              changeStatus(
                item.status === "excluded" ? "candidate" : "excluded",
              )
            }
          >
            {item.status === "excluded" ? "제외 취소" : "제외"}
          </Button>
          {status === "selected" ? (
            <Button
              variant="gray"
              disabled={write.isPending}
              onClick={() => changeStatus("candidate")}
            >
              선택 취소
            </Button>
          ) : (
            <Button
              disabled={write.isPending}
              onClick={() => changeStatus("selected")}
            >
              선택
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export default function CandidateList({
  list,
  data,
  onEdit,
}: {
  list: ProjectListDefinition;
  data: ProjectDetail;
  onEdit: (id: string) => void;
}) {
  const { data: account } = useAccount();
  const amountFormat = account?.amountFormat ?? "won";
  const [selectedId, setSelectedId] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const {
    source,
    people,
    assignedTo,
    candidates: evaluated,
  } = projectCandidates(list, data);
  const candidates = evaluated.map((candidate): Candidate => ({
    ...candidate,
    photos: data.photos.filter(({ item_id }) => item_id === candidate.item.id),
  }));
  const focused = candidates.find(({ item }) => item.id === selectedId);

  return (
    <>
      <CandidateSummary
        candidates={candidates}
        source={source}
        assigned={people.filter(({ id }) => assignedTo.get(id)).length}
        amountFormat={amountFormat}
      />
      {candidates.length === 0 ? (
        <EmptyState message="아직 후보가 없어요." />
      ) : (
        <section
          aria-label="후보 목록"
          data-od-id="prj-candidate-list"
          className={cn(
            "mt-6 grid grid-cols-[44px_minmax(0,1fr)_fit-content(26%)_fit-content(28%)] gap-x-3",
            "[&>button+button]:border-t [&>button+button]:border-border",
          )}
        >
          <div className="col-span-full grid grid-cols-subgrid pb-1 text-caption-sm text-muted-foreground">
            <span className="col-start-2">후보</span>
            <span className="text-right">단가</span>
            <span className="text-right">총 금액</span>
          </div>
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.item.id}
              candidate={candidate}
              projectId={list.project_id}
              members={data.members}
              amountFormat={amountFormat}
              onSelect={(element) => {
                trigger.current = element;
                setSelectedId(candidate.item.id);
              }}
            />
          ))}
        </section>
      )}
      {focused && (
        <CandidateDetail
          amountFormat={amountFormat}
          candidate={focused}
          list={list}
          people={people}
          assignedTo={assignedTo}
          members={data.members}
          viewerId={account?.userId}
          onClose={() => setSelectedId(undefined)}
          restoreFocus={() => trigger.current?.focus()}
          onEdit={() => onEdit(focused.item.id)}
        />
      )}
    </>
  );
}
