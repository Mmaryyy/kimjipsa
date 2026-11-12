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
  FormSheet,
  PageLayout,
  PullToAdd,
} from "@/shared/ui";
import EventForm from "./event-form";
import EventFormSkeleton from "./event-form/Skeleton";
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
        <EventListSkeleton title="D-day" dday />
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
  formId,
  onDirtyChange,
}: {
  onSaved: () => void;
  initialDate?: string;
  formId: string;
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
  if (categories.isPending) return <EventFormSkeleton />;
  if (!categories.data.length)
    return (
      <EmptyState message="카테고리가 없어요. 가정 설정에서 추가해 주세요." />
    );
  return (
    <EventForm
      onDirtyChange={onDirtyChange}
      formId={formId}
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
  const [sheet, setSheet] = useState<{
    mode: "closed" | "new" | "view";
    id: string | null;
  }>({
    mode: parsedEvent.success
      ? "view"
      : params?.get("create") === "1"
        ? "new"
        : "closed",
    id: parsedEvent.success ? parsedEvent.data : null,
  });
  const [dirty, setDirty] = useState(false);
  const close = () => {
    setDirty(false);
    setSheet({ mode: "closed", id: null });
  };
  const openNew = () => setSheet({ mode: "new", id: null });
  return (
    <PullToAdd
      action="일정 등록하기"
      onAdd={openNew}
      disabled={sheet.mode !== "closed"}
    >
      <div data-od-id="calendar-main">
        <EventList
          onOpen={(id) => setSheet({ mode: "view", id })}
          onAdd={openNew}
        />
        <FormSheet
          dirty={dirty}
          open={sheet.mode === "new"}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title="새 일정"
          odId="sheet-new-event"
          submitLabel="추가"
          submitOdId="new-save"
          cancelOdId="new-cancel"
          description="제목과 날짜를 입력하고 공유 또는 개인 일정으로 저장해요."
        >
          {(formId) =>
            sheet.mode === "new" && (
              <NewEvent
                formId={formId}
                initialDate={initialDate}
                onDirtyChange={setDirty}
                onSaved={close}
              />
            )
          }
        </FormSheet>
        {sheet.id && sheet.mode === "view" && (
          <EventDetail key={sheet.id} id={sheet.id} onClose={close} />
        )}
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
