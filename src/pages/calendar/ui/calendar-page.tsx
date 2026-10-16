"use client";
import { useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import {
  useEvents,
  useEventCategories,
  eventTimeLabel,
  type CalendarEvent,
  type EventCategory,
} from "@/entities/event";
import { eventRoutes } from "@/shared/config";
import {
  Button,
  CategoryDot,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageHeader,
  Sheet,
  TextButton,
} from "@/shared/ui";
import { EventForm } from "./event-form";
import { EventDetail } from "./event-detail";
function EventRow({
  event,
  categories,
  onOpen,
}: {
  event: CalendarEvent;
  categories: EventCategory[];
  onOpen: (id: string) => void;
}) {
  const category = categories.find(
    (category) => category.id === event.details?.categoryId,
  );
  if (!event.details)
    return (
      <ListRow
        leading={
          <LockKeyhole
            aria-hidden="true"
            size={16}
            className="text-muted-foreground"
          />
        }
        description={eventTimeLabel(event)}
        className="text-muted-foreground"
      >
        개인 일정
      </ListRow>
    );
  return (
    <ListRow
      leading={category && <CategoryDot color={category.color} />}
      description={eventTimeLabel(event)}
    >
      <TextButton
        className="max-w-full whitespace-normal break-words text-left"
        onClick={() => onOpen(event.id)}
      >
        {event.details.title}
      </TextButton>
    </ListRow>
  );
}
function EventList({ onOpen }: { onOpen: (id: string) => void }) {
  const events = useEvents();
  const categories = useEventCategories();
  if (events.isError)
    return (
      <ErrorState
        message={events.error.message}
        onRetry={() => {
          void events.refetch();
        }}
      />
    );
  if (categories.isError)
    return (
      <ErrorState
        message={categories.error.message}
        onRetry={() => {
          void categories.refetch();
        }}
      />
    );
  if (events.isPending || categories.isPending)
    return <ListSkeleton label="일정을 불러오고 있어요" />;
  if (!events.data.length)
    return (
      <EmptyState message="등록한 일정이 없어요. 새 일정을 만들어 보세요." />
    );
  return (
    <List>
      {events.data.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          categories={categories.data}
          onOpen={onOpen}
        />
      ))}
    </List>
  );
}
function NewEvent({ onSaved }: { onSaved: () => void }) {
  const categories = useEventCategories();
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
  if (!categories.data.length)
    return (
      <EmptyState message="카테고리가 없어요. 가정 설정에서 추가해 주세요." />
    );
  return <EventForm categories={categories.data} onSaved={onSaved} />;
}
export function CalendarPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="일정"
        actions={<Button onClick={() => setCreating(true)}>일정 만들기</Button>}
      />
      <Link href={eventRoutes.categories} className="text-primary">
        카테고리 관리하기
      </Link>
      <EventList onOpen={setSelectedId} />
      <Sheet
        open={creating}
        onOpenChange={setCreating}
        title="일정 만들기"
        description="제목과 날짜를 입력하고 공유 또는 개인 일정으로 저장해요."
      >
        {creating && <NewEvent onSaved={() => setCreating(false)} />}
      </Sheet>
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title="일정 상세"
        description="일정 내용을 확인하고 수정하거나 삭제해요."
      >
        {selectedId && (
          <EventDetail
            key={selectedId}
            id={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </Sheet>
    </>
  );
}
