import {
  kstDate,
  EventOccurrenceRow,
  type EventOccurrence,
  type EventCategory,
} from "@/entities/event";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { EmptyState, List, SectionHeader, GroupLabel } from "@/shared/ui";
export function UpcomingEvents({
  occurrences,
  categories,
  ownerNames,
}: {
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  count: number;
}) {
  const dates = [...new Set(occurrences.map(({ startDate }) => startDate))];
  return (
    <section data-od-id="upcoming-widget" aria-labelledby="upcoming-title">
      <SectionHeader id="upcoming-title" title="다가오는 일정" />
      {dates.length === 0 && <EmptyState message="다가오는 일정이 없어요." />}
      {dates.map((date) => (
        <div key={date}>
          <GroupLabel as="h3">
            {format(kstDate(date), "M월 d일 EEEE", { locale: ko })}
          </GroupLabel>
          <List>
            {occurrences
              .filter(({ startDate }) => startDate === date)
              .map((occurrence) => (
                <EventOccurrenceRow
                  key={occurrence.event.id}
                  occurrence={occurrence}
                  categories={categories}
                  ownerNames={ownerNames}
                />
              ))}
          </List>
        </div>
      ))}
    </section>
  );
}
