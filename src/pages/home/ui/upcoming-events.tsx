import {
  EventOccurrenceRow,
  type EventOccurrence,
  type EventCategory,
} from "@/entities/event";
import { EmptyState, List, SectionHeader, Text } from "@/shared/ui";
export function UpcomingEvents({
  occurrences,
  categories,
}: {
  occurrences: EventOccurrence[];
  categories: EventCategory[];
}) {
  const dates = [...new Set(occurrences.map(({ startDate }) => startDate))];
  return (
    <section aria-labelledby="upcoming-title">
      <SectionHeader id="upcoming-title" title="다가오는 일정" />
      {dates.length === 0 && <EmptyState message="다가오는 일정이 없어요." />}
      {dates.map((date) => (
        <div key={date}>
          <Text as="h3" variant="headline">
            {date}
          </Text>
          <List>
            {occurrences
              .filter(({ startDate }) => startDate === date)
              .map((occurrence) => (
                <EventOccurrenceRow
                  key={occurrence.event.id}
                  occurrence={occurrence}
                  categories={categories}
                />
              ))}
          </List>
        </div>
      ))}
    </section>
  );
}
