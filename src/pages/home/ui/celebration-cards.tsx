"use client";
import {
  kstDate,
  useDdayDismissals,
  useDismissDdayCard,
  nextDday,
  type CalendarEvent,
} from "@/entities/event";
import { X } from "lucide-react";
import { format } from "date-fns";
import { TextButton, ErrorState, ListSkeleton, Text } from "@/shared/ui";
import { useConfettiBurst } from "../model/use-confetti-burst";
function CelebrationCard({
  event,
  anniversary,
  date,
  onDismiss,
  dismissing,
}: {
  event: CalendarEvent;
  anniversary: number;
  date: string;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  const bannerRef = useConfettiBurst(true);
  return (
    <article
      ref={bannerRef}
      className="relative overflow-hidden bg-[var(--fill-quaternary)] px-4 pt-4.5 pb-4"
      aria-label={`${event.details?.title} 축하`}
    >
      <Text
        as="p"
        variant="caption"
        className="font-semibold tracking-[0.02em] text-[var(--celebrate-text)]"
      >
        오늘 · {format(kstDate(date), "yyyy년 M월 d일")}
      </Text>
      <Text as="h2" variant="title" className="mt-0.5 pr-6">
        {event.details?.title}
        {anniversary > 0 && ` ${anniversary}주년`}
      </Text>
      <Text as="p" variant="body-sm" className="mt-1 text-muted-foreground">
        {event.details?.celebrateMessage || "소중한 날을 축하해요!"}
      </Text>
      <TextButton
        className="absolute right-0 top-2"
        aria-label="오늘 축하 닫기"
        onClick={onDismiss}
        disabled={dismissing}
      >
        <X size={18} className="text-[var(--icon-secondary)]" />
      </TextButton>
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
  const dismiss = useDismissDdayCard();
  const cards = events
    .filter(
      (event) =>
        event.kind === "dday" && event.details?.ddayStyle === "celebrate",
    )
    .map((event) => ({ event, dday: nextDday(event.startDate, instant) }))
    .filter(
      ({ event, dday }) =>
        dday.daysUntil === 0 &&
        !dismissals.data?.some(
          (dismissal) =>
            dismissal.event_id === event.id &&
            dismissal.year === Number(dday.date.slice(0, 4)),
        ),
    );
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
  return (
    <div>
      {cards.map(({ event, dday }) => (
        <CelebrationCard
          key={`${event.id}-${dday.date}`}
          event={event}
          anniversary={dday.anniversary}
          date={dday.date}
          onDismiss={() => dismiss.mutate(event.id)}
          dismissing={dismiss.isPending}
        />
      ))}
      {dismiss.error && (
        <Text as="p" role="alert" className="text-error-text">
          {dismiss.error.message}
        </Text>
      )}
    </div>
  );
}
