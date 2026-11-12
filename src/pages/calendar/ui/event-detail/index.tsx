"use client";
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
  Button,
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
const EventDetail = ({
  id,
  formId,
  onClose,
  editing,
  onEditingChange,
  onDirtyChange,
}: {
  id: string;
  formId?: string;
  onClose: () => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const event = useEvent(id);
  const categories = useEventCategories();
  const confirm = useConfirm();
  const { onDelete, deleteError } = useEventEditor(
    event.data?.id ?? id,
    onClose,
  );
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
    return <EmptyState message="일정을 찾을 수 없거나 내용을 볼 수 없어요." />;
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
        onDirtyChange={onDirtyChange}
        key={id}
        event={event.data}
        categories={categories.data}
        onSaved={onClose}
      />
    );
  const category = categories.data.find(
    (category) => category.id === details.categoryId,
  );
  const deleteDescription = "삭제한 일정은 되돌릴 수 없어요.";
  return (
    <article className="grid gap-4">
      <Text as="h2" variant="title">
        {details.title}
      </Text>
      <Text as="p">
        {event.data.startDate === event.data.endDate &&
          `${event.data.startDate} · `}
        {eventTimeLabel(event.data)}
      </Text>
      <Text as="p" variant="caption">
        {event.data.visibility === "private" ? "개인 일정" : "공유 일정"}
      </Text>
      {event.data.ownerId === null && (
        <Text as="p" variant="caption">
          작성자 · 탈퇴한 사용자
        </Text>
      )}
      {category && (
        <div className="flex items-center gap-2">
          <CategoryDot color={category.color} />
          <Text>{category.name}</Text>
        </div>
      )}
      <dl className="grid gap-2">
        <dt className="text-muted-foreground">반복</dt>
        <dd>
          {event.data.kind === "dday"
            ? "매년"
            : getOptionLabel(
                event.data.recurrence ?? "none",
                recurrenceOptions,
                "안 함",
              )}
        </dd>
        <dt className="text-muted-foreground">알림</dt>
        <dd>
          {getOptionLabel<ReminderOptionValue | null>(
            event.data.remindBefore === undefined
              ? 30
              : event.data.remindBefore,
            reminderOptions,
            "없음",
          )}
        </dd>
        <dt className="text-muted-foreground">장소</dt>
        <dd className="break-words">
          {details.place || "등록한 장소가 없어요"}
        </dd>
        <dt className="text-muted-foreground">메모</dt>
        <dd className="whitespace-pre-wrap break-words">
          {details.memo || "등록한 메모가 없어요"}
        </dd>
      </dl>
      {event.data.canEdit && (
        <div className="flex gap-3">
          <Button variant="gray" onClick={() => onEditingChange(true)}>
            수정하기
          </Button>
          <TextButton
            data-od-id="detail-delete"
            tone="danger"
            onClick={() =>
              void confirm({
                targetName: details.title,
                title: "일정을 삭제할까요?",
                description: deleteDescription,
                confirmLabel: event.data?.recurrence
                  ? "이후 모든 일정"
                  : "삭제하기",
                onConfirm: () =>
                  onDelete(event.data?.recurrence ? "following" : undefined),
                secondaryAction: event.data?.recurrence
                  ? { label: "이 일정만", onClick: () => onDelete("single") }
                  : undefined,
              })
            }
          >
            일정 삭제
          </TextButton>
        </div>
      )}
      {deleteError && (
        <Text as="p" role="alert" className="text-error-text">
          {deleteError.message}
        </Text>
      )}
    </article>
  );
};

export default EventDetail;
