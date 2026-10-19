"use client";
import { Suspense, useState } from "react";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFamily } from "@/features/family";
import { CalendarView } from "@/widgets/calendar-view";
import {
  useEvents,
  useEventCategories,
  eventDateInput,
  useCalendarClock,
} from "@/entities/event";
import { eventRoutes } from "@/shared/config";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TextButton,
  Sheet,
} from "@/shared/ui";
import { EventForm } from "./event-form";
import { EventDetail } from "./event-detail";
function EventList({
  onOpen,
  onAdd,
}: {
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const instant = useCalendarClock();
  const events = useEvents();
  const family = useFamily();
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
  if (family.isError)
    return (
      <ErrorState
        message={family.error.message}
        onRetry={() => {
          void family.refetch();
        }}
      />
    );
  if (events.isPending || categories.isPending || family.isPending)
    return <ListSkeleton label="일정을 불러오고 있어요" />;
  return (
    <CalendarView
      ownerNames={Object.fromEntries(
        (family.data?.members ?? []).map((member) => [
          member.user_id,
          member.display_name,
        ]),
      )}
      events={events.data}
      categories={categories.data}
      today={eventDateInput(instant.toISOString())}
      onOpen={onOpen}
      onAdd={onAdd}
    />
  );
}

function NewEvent({
  onSaved,
  initialDate,
}: {
  onSaved: () => void;
  initialDate?: string;
}) {
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
  return (
    <EventForm
      formId="new-event-form"
      initialDate={initialDate}
      categories={categories.data}
      onSaved={onSaved}
    />
  );
}
function CalendarContent() {
  const params = useSearchParams();
  const parsedDate = z.iso.date().safeParse(params?.get("date"));
  const initialDate = parsedDate.success ? parsedDate.data : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(params?.get("create") === "1");
  return (
    <div data-od-id="calendar-main">
      <EventList onOpen={setSelectedId} onAdd={() => setCreating(true)} />
      <Link
        href={eventRoutes.categories}
        className="mt-4 inline-block text-caption text-primary"
      >
        카테고리 관리하기
      </Link>
      <Sheet
        open={creating}
        onOpenChange={setCreating}
        title="새 일정"
        odId="sheet-new-event"
        closeLabel="취소"
        closeOdId="new-cancel"
        action={
          <TextButton data-od-id="new-save" type="submit" form="new-event-form">
            추가
          </TextButton>
        }
        description="제목과 날짜를 입력하고 공유 또는 개인 일정으로 저장해요."
      >
        {creating && (
          <NewEvent
            initialDate={initialDate}
            onSaved={() => setCreating(false)}
          />
        )}
      </Sheet>
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title="일정"
        odId="sheet-event-detail"
        closeLabel="완료"
        closePosition="end"
        closeOdId="detail-done"
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
    </div>
  );
}

export function CalendarPage() {
  return (
    <Suspense fallback={<ListSkeleton label="일정을 준비하고 있어요" />}>
      <CalendarContent />
    </Suspense>
  );
}
