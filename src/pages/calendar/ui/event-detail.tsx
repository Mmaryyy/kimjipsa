"use client";
import { useState } from "react";
import { useEvent, useEventCategories, eventTimeLabel } from "@/entities/event";
import {
  Button,
  TextButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Text,
  CategoryDot,
} from "@/shared/ui";
import { useEventEditor } from "../model/use-event-editor";
import { EventForm } from "./event-form";
export function EventDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const event = useEvent(id);
  const categories = useEventCategories();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { onDelete, deleting, deleteError } = useEventEditor(id, onClose);
  if (event.isError)
    return (
      <ErrorState
        message={event.error.message}
        onRetry={() => {
          void event.refetch();
        }}
      />
    );
  if (event.isPending) return <ListSkeleton label="일정을 불러오고 있어요" />;
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
  if (categories.isPending)
    return <ListSkeleton label="카테고리를 불러오고 있어요" />;
  if (categories.data.length === 0)
    return (
      <EmptyState message="카테고리가 없어요. 가정 설정에서 추가해 주세요." />
    );
  if (editing && event.data.canEdit)
    return (
      <EventForm
        key={id}
        event={event.data}
        categories={categories.data}
        onSaved={onClose}
      />
    );
  const category = categories.data.find(
    (category) => category.id === details.categoryId,
  );
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
        {event.data.visibility === "private" ? "개인 일정" : "둘 다"}
      </Text>
      {category && (
        <div className="flex items-center gap-2">
          <CategoryDot color={category.color} />
          <Text>{category.name}</Text>
        </div>
      )}
      <dl className="grid gap-2">
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
          <Button variant="gray" onClick={() => setEditing(true)}>
            수정하기
          </Button>
          <TextButton
            data-od-id="detail-delete"
            tone="danger"
            onClick={() => setConfirming(true)}
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
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!deleting) setConfirming(open);
        }}
        targetName={details.title}
        title="일정을 삭제할까요?"
        description={deleteError?.message ?? "삭제한 일정은 되돌릴 수 없어요."}
        onConfirm={onDelete}
        pending={deleting}
      />
    </article>
  );
}
