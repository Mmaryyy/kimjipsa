"use client";

import {
  useDdayDismissals,
  useDismissDdayCard,
  nextDday,
  type CalendarEvent,
} from "@/entities/event";
import { ErrorState, Text } from "@/shared/ui";
import CelebrationCard from "./Card";

interface Props {
  events: CalendarEvent[];
  instant: Date;
}

const CelebrationCardList = ({ events, instant }: Props) => {
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

  if (dismissals.isPending) return null;

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
};

export default CelebrationCardList;
