"use client";
import { useState } from "react";
import {
  useEvent,
  useEventCategories,
  eventTimeLabel,
  reminderOptions,
  recurrenceOptions,
  type ReminderOptionValue,
} from "@/entities/event";
import { getOptionLabel } from "@/shared/lib";
import {
  FormSheet,
  TextButton,
  useConfirm,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonSection,
  Text,
  CategoryDot,
} from "@/shared/ui";
import { useEventEditor } from "../../model/use-event-editor";
import EventForm from "../event-form";
const EventDetailSkeleton = () => (
  <SkeletonSection label="일정을 불러오고 있어요">
    <Skeleton className="h-80" />
  </SkeletonSection>
);
const EventDetail = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const [editing, setEditing] = useState(false);
  const event = useEvent(id);
  const categories = useEventCategories();
  const confirm = useConfirm();
  const { onDelete, deleteError } = useEventEditor(
    event.data?.id ?? id,
    onClose,
  );
  const [dirty, setDirty] = useState(false);
  const remove = () =>
    confirm({
      targetName: event.data?.details?.title,
      title: "일정을 삭제할까요?",
      description: "삭제한 일정은 되돌릴 수 없어요.",
      confirmLabel: event.data?.recurrence ? "이후 모든 일정" : "삭제",
      onConfirm: () =>
        onDelete(event.data?.recurrence ? "following" : undefined),
      secondaryAction: event.data?.recurrence
        ? { label: "이 일정만", onClick: () => onDelete("single") }
        : undefined,
    });
  const content = (formId: string, onSaved: () => void) => {
    if (event.isError)
      return (
        <ErrorState
          message={event.error.message}
          onRetry={() => {
            void event.refetch();
          }}
        />
      );
    if (event.isPending) return <EventDetailSkeleton />;
    if (!event.data?.details)
      return (
        <EmptyState message="일정을 찾을 수 없거나 내용을 볼 수 없어요." />
      );
    const details = event.data.details;
    if (categories.isError)
      return (
        <ErrorState
          message={categories.error.message}
          onRetry={() => {
            void categories.refetch();
          }}
        />
      );
    if (categories.isPending) return <EventDetailSkeleton />;
    if (categories.data.length === 0)
      return (
        <EmptyState message="카테고리가 없어요. 가정 설정에서 추가해 주세요." />
      );
    if (editing && event.data.canEdit)
      return (
        <EventForm
          formId={formId}
          onDirtyChange={setDirty}
          key={id}
          event={event.data}
          categories={categories.data}
          onSaved={onSaved}
        />
      );
    const category = categories.data.find(
      (category) => category.id === details.categoryId,
    );
    return (
      <article className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <Text variant="caption">
            {event.data.visibility === "private" ? "개인 일정" : "공유 일정"}
          </Text>
          {category && (
            <span className="inline-flex items-center gap-2">
              <CategoryDot color={category.color} />
              <Text variant="caption">{category.name}</Text>
            </span>
          )}
        </div>
        <Text as="h2" variant="title">
          {details.title}
        </Text>
        <Text as="p">
          {event.data.startDate === event.data.endDate &&
            `${event.data.startDate} · `}
          {eventTimeLabel(event.data)}
        </Text>
        {event.data.ownerId === null && (
          <Text as="p" variant="caption">
            작성자 · 탈퇴한 사용자
          </Text>
        )}
        <dl className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-caption text-muted-foreground">반복</dt>
              <dd>
                {event.data.kind === "dday"
                  ? "매년"
                  : getOptionLabel(
                      event.data.recurrence ?? "none",
                      recurrenceOptions,
                      "안 함",
                    )}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">알림</dt>
              <dd>
                {getOptionLabel<ReminderOptionValue | null>(
                  event.data.remindBefore === undefined
                    ? 30
                    : event.data.remindBefore,
                  reminderOptions,
                  "없음",
                )}
              </dd>
            </div>
          </div>
          <div className="grid gap-1">
            <dt className="text-caption text-muted-foreground">장소</dt>
            <dd className="break-words">
              {details.place || "등록한 장소가 없어요"}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-caption text-muted-foreground">메모</dt>
            <dd className="whitespace-pre-wrap break-words">
              {details.memo || "등록한 메모가 없어요"}
            </dd>
          </div>
        </dl>
        {deleteError && (
          <Text as="p" role="alert" className="text-error-text">
            {deleteError.message}
          </Text>
        )}
      </article>
    );
  };
  const canEdit = Boolean(
    event.data?.details && event.data.canEdit && categories.data?.length,
  );
  return (
    <FormSheet
      onSaved={onClose}
      onCancel={() => {
        setDirty(false);
        setEditing(false);
      }}
      open
      title="일정"
      description="일정 내용을 확인하고 수정하거나 삭제해요."
      odId="sheet-event-detail"
      dirty={dirty}
      editable={editing && canEdit}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      leadingAction={() =>
        canEdit && (
          <TextButton
            tone="danger"
            aria-label="일정 삭제"
            data-od-id="detail-delete"
            onClick={() => void remove()}
          >
            삭제
          </TextButton>
        )
      }
      action={
        canEdit && (
          <TextButton aria-label="일정 수정" onClick={() => setEditing(true)}>
            수정
          </TextButton>
        )
      }
    >
      {content}
    </FormSheet>
  );
};

export default EventDetail;
