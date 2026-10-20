import { CategoryDot, ListRow, Text, TextButton } from "@/shared/ui";
import {
  ddayBadgeStyles,
  ddayLabelStyles,
} from "./event-occurrence-row.variants";

import type { EventCategory } from "../api/type";
import type { EventOccurrence } from "../lib/event-occurrences.utils";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { eventRoutes } from "@/shared/config";
import { format } from "date-fns";
import { kstDate } from "../lib/dday.utils";

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
  const privateEvent = event.visibility === "private";
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
  let metadata = [
    event.startDate !== event.endDate &&
      `${occurrence.startDate} ~ ${occurrence.endDate}`,
    event.details?.place,
    privateEvent ? owner && `${owner}님` : "둘 다",
  ]
    .filter(Boolean)
    .join(" · ");
  if (!event.details)
    metadata = [owner && `${owner}님`, event.endTime && `${event.endTime}까지`]
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
  const time =
    event.isAllDay || date > occurrence.startDate
      ? "종일"
      : (event.startTime ?? "시간 미정");
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
        ) : privateEvent ? (
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
