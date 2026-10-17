"use client";
import {
  useDdayDismissals,
  useDismissDdayCard,
  nextDday,
  type CalendarEvent,
} from "@/entities/event";
import { Button, ErrorState, ListSkeleton, Text } from "@/shared/ui";
function CelebrationCard({
  event,
  anniversary,
}: {
  event: CalendarEvent;
  anniversary: number;
}) {
  const dismiss = useDismissDdayCard();
  return (
    <article
      className="relative overflow-hidden py-4 text-[var(--celebrate-text)]"
      aria-label={`${event.details?.title} 축하`}
    >
      <div className="kj-celebration-confetti" aria-hidden="true">
        ✦ · ✧ · ✦ · ✧
      </div>
      <Text as="h2" variant="title">
        {event.details?.title}
        {anniversary > 0 && ` ${anniversary}주년`}
      </Text>
      <Text as="p">
        {event.details?.celebrateMessage || "소중한 날을 축하해요!"}
      </Text>
      <Button
        variant="gray"
        onClick={() => dismiss.mutate(event.id)}
        disabled={dismiss.isPending}
      >
        오늘 축하 닫기
      </Button>
      {dismiss.error && (
        <Text as="p" role="alert" className="text-error-text">
          {dismiss.error.message}
        </Text>
      )}
    </article>
  );
}
export function CelebrationCards({
  events,
  instant,
}: {
  events: CalendarEvent[];
  instant: Date;
}) {
  const dismissals = useDdayDismissals();
  if (dismissals.isError)
    return (
      <ErrorState
        message={dismissals.error.message}
        onRetry={() => {
          void dismissals.refetch();
        }}
      />
    );
  if (dismissals.isPending)
    return <ListSkeleton label="축하 일정을 불러오고 있어요" />;
  const cards = events
    .filter(
      (event) =>
        event.kind === "dday" && event.details?.ddayStyle === "celebrate",
    )
    .map((event) => ({ event, dday: nextDday(event.startDate, instant) }))
    .filter(
      ({ event, dday }) =>
        dday.daysUntil === 0 &&
        !dismissals.data.some(
          (dismissal) =>
            dismissal.event_id === event.id &&
            dismissal.year === Number(dday.date.slice(0, 4)),
        ),
    );
  return (
    <>
      {cards.map(({ event, dday }) => (
        <CelebrationCard
          key={`${event.id}-${dday.date}`}
          event={event}
          anniversary={dday.anniversary}
        />
      ))}
    </>
  );
}
