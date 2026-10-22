import { CategoryDot, ListRow, Text, TextButton } from "@/shared/ui";
import {
  ddayBadgeStyles,
  ddayLabelStyles,
} from "./event-occurrence-row.variants";

import { eventVisibility } from "../model/event.constants";
import type { EventCategory } from "../api/type";
import type { EventOccurrence } from "../lib/event-occurrences.utils";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { eventRoutes } from "@/shared/config";
import { format } from "date-fns";
import { kstDate } from "../lib/dday.utils";

import { eventDayTimeLabel } from "../lib/event-date.utils";

export function EventOccurrenceRow({
  occurrence,
  categories,
  ownerNames,
  onOpen,
  showDdayDate = false,
  showDdayCountdown = true,
  date = occurrence.startDate,
}: {
  occurrence: EventOccurrence;
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  showDdayDate?: boolean;
  showDdayCountdown?: boolean;
  date?: string;
}) {
  const { event, dday } = occurrence;
  const category = categories.find(
    (category) => category.id === event.details?.categoryId,
  );
  const owner = event.ownerId ? ownerNames?.[event.ownerId] : undefined;
  const ownerLabel = owner && `${owner} 님`;
  const privateEvent = event.visibility === "private";
  const ownPrivateEvent = privateEvent && event.canEdit;
  const visibilityLabel = eventVisibility[event.visibility];
  const privateOwnerLabel = ownPrivateEvent ? "나" : ownerLabel;
  const celebrated = event.details?.ddayStyle === "celebrate";
  const dotColor = privateEvent
    ? "var(--sys-gray3)"
    : celebrated && showDdayCountdown
      ? "var(--celebrate)"
      : category
        ? undefined
        : "var(--label-tertiary)";
  const ddayTone =
    dday?.daysUntil === 0
      ? "today"
      : dday && dday.daysUntil >= 1 && dday.daysUntil <= 7
        ? "soon"
        : "distant";
  const titleText = event.details?.title ?? "개인 일정";
  let title = <span>{titleText}</span>;
  if (event.details)
    title = onOpen ? (
      <TextButton
        className="max-w-full text-left whitespace-normal text-foreground text-body font-normal"
        onClick={() => onOpen(event.id)}
      >
        {titleText}
      </TextButton>
    ) : (
      <Link
        className={showDdayDate ? "block truncate" : "break-words"}
        href={`${eventRoutes.calendar}?view=day&date=${occurrence.startDate}`}
      >
        {titleText}
      </Link>
    );
  const time = eventDayTimeLabel(event, date);
  let metadata = [
    visibilityLabel,
    privateEvent && privateOwnerLabel,
    event.details?.place,
    !event.isAllDay &&
      !time.startsWith("~") &&
      event.endTime &&
      `${event.endTime}까지`,
  ]
    .filter(Boolean)
    .join(" · ");
  if (dday) {
    const dateFormat = dday.anniversary > 0 ? "yyyy년 M월 d일" : "M월 d일";
    metadata = [
      showDdayDate && format(kstDate(occurrence.startDate), dateFormat),
      dday.anniversary > 0
        ? `${dday.anniversary}주년`
        : celebrated
          ? "축하"
          : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return (
    <ListRow
      className={!event.details ? "text-muted-foreground" : undefined}
      leading={
        <>
          {!dday && (
            <Text
              variant="caption"
              className="w-[60px] shrink-0 text-muted-foreground tabular-nums"
            >
              {time}
            </Text>
          )}
          <CategoryDot color={category?.color} cssColor={dotColor} />
        </>
      }
      description={metadata}
      trailing={
        dday && showDdayCountdown ? (
          <Text
            variant={showDdayDate ? "title" : "caption"}
            className={ddayLabelStyles({
              size: showDdayDate ? "title" : "caption",
              tone: ddayTone,
            })}
          >
            <span className={ddayBadgeStyles({ today: ddayTone === "today" })}>
              {dday.label}
            </span>
          </Text>
        ) : privateEvent && !ownPrivateEvent ? (
          <LockKeyhole
            size={16}
            aria-label="개인 일정"
            className="text-[var(--icon-tertiary)]"
          />
        ) : undefined
      }
    >
      {title}
    </ListRow>
  );
}
