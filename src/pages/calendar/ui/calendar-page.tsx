"use client";
import { Suspense, useState } from "react";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
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
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TextButton,
  PageLayout,
  PullToAdd,
} from "@/shared/ui";
import { EventEditorSheet } from "./event-editor-sheet";
import EventForm from "./event-form";
import EventDetail from "./event-detail";
function EventList({
  onOpen,
  onAdd,
}: {
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const instant = useCalendarClock();
  const params = useSearchParams();
  const selected = z.iso.date().safeParse(params?.get("date"));
  const year = Number(
    (selected.success
      ? selected.data
      : eventDateInput(instant.toISOString())
    ).slice(0, 4),
  );
  const events = useEvents({
    start: `${Math.max(1, year - 1)}-01-01`,
    end: `${Math.min(9999, year + 1)}-12-31`,
  });
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
    <PageLayout width="wide" className="grid gap-10">
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
    </PageLayout>
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
  const parsedEvent = z
    .string()
    .regex(/^[0-9a-f-]{36}(~\d{4}-\d{2}-\d{2})?$/i)
    .safeParse(params?.get("event"));
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
    <PullToAdd
      action="일정 등록하기"
      onAdd={() => setCreating(true)}
      disabled={creating || selectedId !== null}
    >
      <div data-od-id="calendar-main">
        <EventList onOpen={setSelectedId} onAdd={() => setCreating(true)} />
        <EventEditorSheet
          dirty={dirty}
          formId="new-event-form"
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
            <TextButton
              data-od-id="new-save"
              type="submit"
              form="new-event-form"
            >
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
          formId={editing ? "edit-event-form" : undefined}
          open={selectedId !== null}
          onOpenChange={(open) => {
            if (!open) closeDetail();
          }}
          title="일정"
          odId="sheet-event-detail"
          showCloseButton={!editing}
          leadingAction={
            editing
              ? (onOpenChange) => (
                  <TextButton onClick={() => onOpenChange(false)}>
                    취소
                  </TextButton>
                )
              : undefined
          }
          action={
            editing ? (
              <TextButton type="submit" form="edit-event-form">
                저장
              </TextButton>
            ) : undefined
          }
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
    </PullToAdd>
  );
}

export function CalendarPage() {
  return (
    <Suspense fallback={<EventListSkeleton title="일정" />}>
      <CalendarContent />
    </Suspense>
  );
}
