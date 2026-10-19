import {
  EventOccurrenceRow,
  nextDday,
  compareOccurrences,
  type CalendarEvent,
  type EventCategory,
} from "@/entities/event";
import { EmptyState, List, SectionHeader } from "@/shared/ui";
export function DdayOverview({
  events,
  categories,
  instant,
}: {
  events: CalendarEvent[];
  categories: EventCategory[];
  instant: Date;
}) {
  const occurrences = events
    .filter((event) => event.kind === "dday")
    .map((event) => {
      const dday = nextDday(event.startDate, instant);
      return { event, startDate: dday.date, endDate: dday.date, dday };
    })
    .sort(compareOccurrences);
  return (
    <section data-od-id="dday-section" aria-labelledby="dday-title">
      <SectionHeader id="dday-title" title="D-day" />
      {occurrences.length === 0 ? (
        <EmptyState message="등록한 D-day가 없어요." />
      ) : (
        <List>
          {occurrences.map((occurrence) => (
            <EventOccurrenceRow
              key={occurrence.event.id}
              showDdayDate
              occurrence={occurrence}
              categories={categories}
            />
          ))}
        </List>
      )}
    </section>
  );
}
