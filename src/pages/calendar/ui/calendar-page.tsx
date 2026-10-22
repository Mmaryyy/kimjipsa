"use client";
import { Suspense, useState } from "react";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFamily } from "@/features/family";
import { CalendarView } from "@/widgets/calendar-view";
import {
  DdayOverview,
  EventListSkeleton,
  calendarDdayLimit,
  useEvents,
  useEventCategories,
  eventDateInput,
  useCalendarClock,
} from "@/entities/event";
import { eventRoutes } from "@/shared/config";
import { EmptyState, ErrorState, ListSkeleton, TextButton } from "@/shared/ui";
import { EventEditorSheet } from "./event-editor-sheet";
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
  const loading = events.isPending || categories.isPending || family.isPending;
  return (
    <div className="grid min-w-0 gap-10">
      <CalendarView
        loading={loading}
        ownerNames={Object.fromEntries(
          (family.data?.members ?? []).map((member) => [
            member.user_id,
            member.display_name,
          ]),
        )}
        events={events.data ?? []}
        categories={categories.data ?? []}
        today={eventDateInput(instant.toISOString())}
        onOpen={onOpen}
        onAdd={onAdd}
      />
      {loading ? (
        <EventListSkeleton title="D-day" dday interactive />
      ) : (
        <DdayOverview
          events={events.data ?? []}
          categories={categories.data ?? []}
          instant={instant}
          onOpen={onOpen}
          limit={calendarDdayLimit}
        />
      )}
    </div>
  );
}

function NewEvent({
  onSaved,
  initialDate,
  onDirtyChange,
}: {
  onSaved: () => void;
  initialDate?: string;
  onDirtyChange: (dirty: boolean) => void;
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
      onDirtyChange={onDirtyChange}
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
  const parsedEvent = z.uuid().safeParse(params?.get("event"));
  const [selectedId, setSelectedId] = useState<string | null>(
    parsedEvent.success ? parsedEvent.data : null,
  );
  const [creating, setCreating] = useState(params?.get("create") === "1");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  function closeNew() {
    setDirty(false);
    setCreating(false);
  }
  function closeDetail() {
    setDirty(false);
    setEditing(false);
    setSelectedId(null);
  }
  return (
    <div data-od-id="calendar-main">
      <EventList onOpen={setSelectedId} onAdd={() => setCreating(true)} />
      <Link
        href={eventRoutes.categories}
        className="mt-4 inline-block text-caption text-primary"
      >
        카테고리 관리하기
      </Link>
      <EventEditorSheet
        dirty={dirty}
        open={creating}
        onOpenChange={(open) => {
          if (!open) closeNew();
        }}
        title="새 일정"
        odId="sheet-new-event"
        leadingAction={(onOpenChange) => (
          <TextButton
            data-od-id="new-cancel"
            onClick={() => onOpenChange(false)}
          >
            취소
          </TextButton>
        )}
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
            onDirtyChange={setDirty}
            onSaved={closeNew}
          />
        )}
      </EventEditorSheet>
      <EventEditorSheet
        dirty={dirty}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        title="일정"
        odId="sheet-event-detail"
        showCloseButton
        description="일정 내용을 확인하고 수정하거나 삭제해요."
      >
        {selectedId && (
          <EventDetail
            key={selectedId}
            id={selectedId}
            onClose={closeDetail}
            editing={editing}
            onEditingChange={setEditing}
            onDirtyChange={setDirty}
          />
        )}
      </EventEditorSheet>
    </div>
  );
}

export function CalendarPage() {
  return (
    <Suspense fallback={<EventListSkeleton title="일정" />}>
      <CalendarContent />
    </Suspense>
  );
}
