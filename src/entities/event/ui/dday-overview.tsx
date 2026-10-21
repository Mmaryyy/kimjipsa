import type { CalendarEvent, EventCategory } from "../api/type";
import { ddayOccurrences } from "../lib/event-occurrences.utils";
import { EventOccurrenceRow } from "./event-occurrence-row";
import { EmptyState, List, SectionHeader } from "@/shared/ui";
export function DdayOverview({
  events,
  categories,
  instant,
  onOpen,
  limit,
}: {
  events: CalendarEvent[];
  categories: EventCategory[];
  instant: Date;
  onOpen?: (id: string) => void;
  limit?: number;
}) {
  const occurrences = ddayOccurrences(events, limit ?? events.length, instant);
  return (
    <section
      className="min-w-0"
      data-od-id="dday-section"
      aria-labelledby="dday-title"
    >
      <SectionHeader id="dday-title" title="D-day" />
      {occurrences.length === 0 ? (
        <EmptyState message="등록한 D-day가 없어요." />
      ) : (
        <List>
          {occurrences.map((occurrence) => (
            <EventOccurrenceRow
              key={occurrence.event.id}
              onOpen={onOpen}
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
