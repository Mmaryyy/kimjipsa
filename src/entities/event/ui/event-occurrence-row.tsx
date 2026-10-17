import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { eventRoutes } from "@/shared/config";
import { CategoryDot, ListRow, TextButton, Text } from "@/shared/ui";
import type { EventCategory } from "../api/type";
import type { EventOccurrence } from "../lib/event-occurrences.utils";
import { eventTimeLabel } from "../lib/event-date.utils";
export function EventOccurrenceRow({
  occurrence,
  categories,
  onOpen,
}: {
  occurrence: EventOccurrence;
  categories: EventCategory[];
  onOpen?: (id: string) => void;
}) {
  const { event, dday } = occurrence;
  const category = categories.find(
    (category) => category.id === event.details?.categoryId,
  );
  if (!event.details)
    return (
      <ListRow
        leading={
          <LockKeyhole
            aria-hidden="true"
            size={16}
            className="text-muted-foreground"
          />
        }
        description={eventTimeLabel({
          ...event,
          startDate: occurrence.startDate,
          endDate: occurrence.endDate,
        })}
        className="text-muted-foreground opacity-50"
      >
        개인 일정
      </ListRow>
    );
  const emphasized =
    event.details.ddayStyle === "celebrate" &&
    dday !== null &&
    dday.daysUntil >= 0 &&
    dday.daysUntil <= 7;
  const title = onOpen ? (
    <TextButton
      className="max-w-full whitespace-normal break-words text-left"
      onClick={() => onOpen(event.id)}
    >
      {event.details.title}
    </TextButton>
  ) : (
    <Link
      className="break-words text-primary"
      href={`${eventRoutes.calendar}?view=day&date=${occurrence.startDate}`}
    >
      {event.details.title}
    </Link>
  );
  return (
    <ListRow
      leading={category && <CategoryDot color={category.color} />}
      description={
        dday
          ? `${dday.label}${event.details.ddayStyle === "celebrate" && dday.anniversary > 0 ? ` · ${dday.anniversary}주년` : ""}`
          : eventTimeLabel(event)
      }
      className={emphasized ? "text-[var(--celebrate-text)]" : undefined}
    >
      {title}
      {category && (
        <Text as="p" variant="caption" className="text-muted-foreground">
          {category.name}
        </Text>
      )}
    </ListRow>
  );
}
