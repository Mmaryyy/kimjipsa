"use client";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LockKeyhole, Plus } from "lucide-react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  kstDate,
  occurrencesInRange,
  EventOccurrenceRow,
  type CalendarView as View,
  type CalendarEvent,
  type EventCategory,
  type EventOccurrence,
} from "@/entities/event";
import { eventRoutes } from "@/shared/config";
import { cn } from "@/shared/lib";
import {
  categoryColors,
  EmptyState,
  List,
  ListSkeleton,
  PageHeader,
  GroupLabel,
  SegmentedControl,
  SectionHeader,
  Text,
  TextButton,
} from "@/shared/ui";
import { calendarNumberStyles } from "./calendar-date.variants";
import { useCalendarLocation } from "../model/use-calendar-location";

type CalendarProps = {
  events: CalendarEvent[];
  categories: EventCategory[];
  today: string;
  defaultView?: View;
  home?: boolean;
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  onAdd?: () => void;
};

function getCalendarNumberTone({
  selected,
  today,
  outside,
  sunday,
}: {
  selected: boolean;
  today: boolean;
  outside: boolean;
  sunday: boolean;
}) {
  if (selected) return "selected";
  if (today) return "today";
  if (sunday) return "sunday";
  if (outside) return "outside";
  return "default";
}

function CalendarDate({
  day,
  selected,
  today,
  occurrences,
  categories,
  onSelect,
  month,
}: {
  day: Date;
  selected: string;
  today: string;
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  onSelect: (date: string) => void;
  month?: number;
}) {
  const date = format(day, "yyyy-MM-dd");
  const daily = occurrences.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
  const isToday = date === today;
  const isSelected = date === selected;
  const outside = month !== undefined && day.getMonth() !== month;
  const numberTone = getCalendarNumberTone({
    selected: isSelected,
    today: isToday,
    outside,
    sunday: day.getDay() === 0,
  });
  const accessibleLabel = [
    format(day, "M월 d일 EEEE", { locale: ko }),
    `일정 ${daily.length}개`,
    isToday && "오늘",
    isSelected && "선택됨",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <TextButton
      className="group/calendar-date flex min-w-0 flex-col gap-1 px-0 pt-2 pb-2.5 text-foreground outline-none"
      onClick={() => onSelect(date)}
      data-od-id={`${month !== undefined ? "month" : "week"}-day-${date}`}
      data-outside={month !== undefined && day.getMonth() !== month}
      data-today={isToday}
      data-selected={isSelected}
      data-sunday={day.getDay() === 0}
      aria-label={accessibleLabel}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
    >
      <span
        className={cn(
          [
            "text-[length:var(--type-caption-sm-size)] font-normal",
            "tracking-[var(--type-caption-sm-tracking)]",
          ],
          day.getDay() === 0
            ? "text-[var(--sys-red-ic)]"
            : "text-muted-foreground",
        )}
      >
        {format(day, "EEEEE", { locale: ko })}
      </span>
      <span
        className={calendarNumberStyles({
          tone: numberTone,
        })}
      >
        {format(day, "d")}
      </span>
      <span
        className="flex h-1.25 gap-0.75 [&_i]:size-1.25 [&_i]:rounded-[var(--r-round)]"
        aria-hidden="true"
      >
        {daily.slice(0, 3).map(({ event }) => {
          const category = categories.find(
            (category) => category.id === event.details?.categoryId,
          );
          const color =
            event.visibility !== "private" && category
              ? categoryColors[category.color]
              : "var(--sys-gray3)";
          return <i key={event.id} style={{ background: color }} />;
        })}
      </span>
    </TextButton>
  );
}

function DayEvents({
  date,
  today,
  home,
  occurrences,
  categories,
  ownerNames,
  onOpen,
  onAdd,
}: {
  date: string;
  today: string;
  home: boolean;
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  onAdd?: () => void;
}) {
  const daily = occurrences.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
  const title = home
    ? date === today
      ? "오늘 일정"
      : `${format(kstDate(date), "M월 d일")} 일정`
    : format(kstDate(date), "M월 d일 EEEE", { locale: ko });
  const add = onAdd ? (
    <TextButton onClick={onAdd} data-od-id="list-add">
      일정 추가
    </TextButton>
  ) : (
    <Link
      className="text-primary text-caption"
      data-od-id="day-add"
      href={`${eventRoutes.calendar}?date=${date}&create=1`}
    >
      일정 추가
    </Link>
  );
  return (
    <section
      aria-label={title}
      data-od-id={home ? "today-schedule" : "cal-day-list"}
    >
      <SectionHeader
        id={home ? "today-schedule-title" : "cal-list-title"}
        title={title}
        action={
          home && (
            <Link
              className="text-caption text-primary"
              data-od-id="today-schedule-more"
              href={eventRoutes.calendar}
            >
              캘린더
            </Link>
          )
        }
      />
      {daily.length === 0 ? (
        <EmptyState
          layout="row"
          icon={null}
          message="등록된 일정이 없어요"
          action={add}
        />
      ) : (
        <List>
          {daily.map((occurrence) => (
            <EventOccurrenceRow
              key={occurrence.event.id}
              occurrence={occurrence}
              showDdayCountdown={home}
              date={date}
              categories={categories}
              ownerNames={ownerNames}
              onOpen={onOpen}
            />
          ))}
        </List>
      )}
      {!home && <>{daily.length > 0 && add}</>}
    </section>
  );
}

function WeekEvents({
  days,
  occurrences,
  categories,
  ownerNames,
  onOpen,
  today,
}: {
  days: Date[];
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  today: string;
}) {
  return (
    <div>
      {days.map((day) => {
        const date = format(day, "yyyy-MM-dd");
        const daily = occurrences.filter(
          (item) => item.startDate <= date && item.endDate >= date,
        );
        return (
          <section key={date} aria-label={date}>
            <GroupLabel
              as="h3"
              className={
                date === today ? "text-[var(--accent-text)]" : undefined
              }
            >
              {format(day, "M월 d일 EEEE", { locale: ko })}
              {date === today && " · 오늘"}
            </GroupLabel>
            {daily.length ? (
              <List>
                {daily.map((occurrence) => (
                  <EventOccurrenceRow
                    key={occurrence.event.id}
                    occurrence={occurrence}
                    showDdayCountdown={false}
                    date={date}
                    categories={categories}
                    ownerNames={ownerNames}
                    onOpen={onOpen}
                  />
                ))}
              </List>
            ) : (
              <Text
                as="p"
                variant="body-sm"
                className="py-3 text-muted-foreground"
              >
                일정 없음
              </Text>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TimelineEvent({
  occurrence,
  categories,
  ownerNames,
  onOpen,
  showTime,
}: {
  occurrence: EventOccurrence;
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  showTime: boolean;
}) {
  const { event, dday } = occurrence;
  const masked = event.details === null;
  const owner = event.ownerId ? ownerNames?.[event.ownerId] : undefined;
  const category = categories.find(
    (category) => category.id === event.details?.categoryId,
  );
  const color =
    event.visibility === "private"
      ? "var(--sys-gray3)"
      : category
        ? categoryColors[category.color]
        : "var(--label-tertiary)";
  const content = (
    <>
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={
          masked
            ? { boxShadow: "inset 0 0 0 1.5px var(--sys-gray3)" }
            : { backgroundColor: color }
        }
      />
      <span className="min-w-0 break-words">
        {masked ? (
          <>
            {showTime && event.startTime && `${event.startTime} `}
            개인 일정{owner && ` · ${owner}님`}
          </>
        ) : (
          <>
            {showTime && event.startTime && `${event.startTime} `}
            {event.details?.title}
            {dday && (
              <span className="block text-caption text-muted-foreground">
                {dday.anniversary > 0
                  ? `${dday.anniversary}주년`
                  : event.details?.ddayStyle === "celebrate"
                    ? "축하"
                    : ""}
              </span>
            )}
          </>
        )}
      </span>
    </>
  );
  const className = cn(
    "flex min-w-0 items-center justify-start gap-2 text-left text-body-sm font-normal",
    masked ? "text-[var(--label-tertiary)]" : "text-foreground",
  );
  if (masked) return <span className={className}>{content}</span>;
  if (onOpen)
    return (
      <TextButton
        className={cn(
          className,
          "h-auto min-h-0 w-full py-0 whitespace-normal",
        )}
        onClick={() => onOpen(event.id)}
      >
        {content}
      </TextButton>
    );
  return (
    <Link
      className={className}
      href={`${eventRoutes.calendar}?view=day&date=${occurrence.startDate}`}
    >
      {content}
    </Link>
  );
}

function DayTimeline({
  date,
  occurrences,
  categories,
  ownerNames,
  onOpen,
}: {
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  date: string;
}) {
  const allDay = occurrences.filter(
    ({ event, startDate, dday }) => dday || event.isAllDay || date > startDate,
  );
  const undetermined = occurrences.filter(
    ({ event, startDate, dday }) =>
      !dday && !event.isAllDay && !event.startTime && date === startDate,
  );
  const timed = occurrences.filter(
    ({ event, startDate, dday }) =>
      !dday && !event.isAllDay && event.startTime && date === startDate,
  );
  const hours = Array.from({ length: 15 }, (_, index) =>
    String(8 + index).padStart(2, "0"),
  );
  const rows = [
    { id: "all-day", label: "종일", events: allDay, showTime: false },
    {
      id: "before-hours",
      label: "08:00 이전",
      events: timed.filter(
        ({ event }) => event.startTime !== null && event.startTime < "08:00",
      ),
      showTime: true,
    },
    ...hours.map((hour) => ({
      id: `hour-${hour}`,
      label: `${hour}:00`,
      events: timed.filter(({ event }) => event.startTime?.startsWith(hour)),
      showTime: true,
    })),
    {
      id: "after-hours",
      label: "23:00 이후",
      events: timed.filter(
        ({ event }) => event.startTime !== null && event.startTime >= "23:00",
      ),
      showTime: true,
    },
    {
      id: "undetermined",
      label: "시간 미정",
      events: undetermined,
      showTime: false,
    },
  ];
  return (
    <>
      <Text
        as="p"
        variant="caption"
        className={cn(
          "mt-3 text-muted-foreground",
          occurrences.length > 0 && "sr-only",
        )}
      >
        {occurrences.length > 0
          ? `일정 ${occurrences.length}개`
          : "등록된 일정이 없어요"}
      </Text>
      <ul className="mt-3">
        {rows
          .filter((row) => row.events.length || row.id.startsWith("hour-"))
          .map((row) => (
            <li
              key={row.id}
              aria-hidden={row.events.length === 0 ? true : undefined}
              className="flex min-h-12 items-start gap-3 py-[9px]"
              data-od-id={row.id}
            >
              <Text
                variant="caption-sm"
                className="w-13 shrink-0 pt-0.5 text-[var(--label-tertiary)] tabular-nums"
              >
                {row.label}
              </Text>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {row.events.map((occurrence) => (
                  <TimelineEvent
                    key={occurrence.event.id}
                    occurrence={occurrence}
                    showTime={row.showTime}
                    categories={categories}
                    ownerNames={ownerNames}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </li>
          ))}
      </ul>
    </>
  );
}

function PrivateEventNotice({
  occurrences,
  ownerNames,
}: {
  occurrences: EventOccurrence[];
  ownerNames?: Record<string, string>;
}) {
  const privateOwners = [
    ...new Set(
      occurrences
        .filter(({ event }) => !event.details)
        .map(({ event }) => event.ownerId && ownerNames?.[event.ownerId])
        .filter(Boolean),
    ),
  ];
  return (
    <Text as="p" variant="caption" className="mt-3 text-muted-foreground">
      {privateOwners.length
        ? `${privateOwners.join("·")}님의 `
        : "다른 구성원의 "}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <LockKeyhole
          size={12}
          className="text-[var(--icon-tertiary)]"
          aria-hidden="true"
        />
        개인 일정
      </span>
      은 시간만 보여요.
    </Text>
  );
}

function CalendarContent({
  events,
  categories,
  today,
  defaultView = "month",
  home = false,
  ownerNames,
  onOpen,
  onAdd,
}: CalendarProps) {
  const { view, date, onViewChange, onDateChange, onMove } =
    useCalendarLocation(defaultView, today);
  const selected = kstDate(date);
  let start = selected;
  let end = selected;
  if (view === "month") {
    start = startOfWeek(startOfMonth(selected));
    end = endOfWeek(endOfMonth(selected));
  } else if (view === "week") {
    start = startOfWeek(selected, { weekStartsOn: 0 });
    end = endOfWeek(selected, { weekStartsOn: 0 });
  }
  const days = eachDayOfInterval({ start, end });
  const occurrences = occurrencesInRange(
    events,
    format(start, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );
  const options = [
    { value: "month", label: "월", odId: "view-month" },
    { value: "week", label: "주", odId: "view-week" },
    { value: "day", label: "일", odId: "view-day" },
  ] as const;
  return (
    <div className="min-w-0">
      {!home && (
        <PageHeader
          odId="calendar"
          titleOdId="cal-title"
          title={
            view === "day"
              ? format(selected, "M월 d일 EEEE", { locale: ko })
              : format(selected, "yyyy년 M월")
          }
          titleVariant="display"
          navigation={
            <div className="flex items-center gap-2">
              <TextButton
                aria-label={
                  view === "month"
                    ? "이전 달"
                    : view === "week"
                      ? "이전 주"
                      : "전날"
                }
                data-od-id="cal-prev"
                onClick={() => onMove(-1)}
              >
                <ChevronLeft size={22} />
              </TextButton>
              <TextButton
                aria-label={
                  view === "month"
                    ? "다음 달"
                    : view === "week"
                      ? "다음 주"
                      : "다음 날"
                }
                data-od-id="cal-next"
                onClick={() => onMove(1)}
              >
                <ChevronRight size={22} />
              </TextButton>
              <TextButton
                className="ml-auto"
                aria-label="일정 추가"
                data-od-id="cal-add"
                onClick={onAdd}
              >
                <Plus size={22} />
              </TextButton>
            </div>
          }
        >
          <div className="mt-2 flex items-center gap-3">
            <SegmentedControl
              odId="cal-view"
              label="보기"
              className="w-full max-w-[280px]"
              options={options}
              value={view}
              onValueChange={onViewChange}
            />
            <TextButton
              size="sm"
              data-od-id="cal-today"
              onClick={() => onDateChange(today)}
            >
              오늘
            </TextButton>
          </div>
        </PageHeader>
      )}
      <div
        className={
          !home && view === "month"
            ? "grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]"
            : "grid gap-2"
        }
      >
        <div data-od-id={!home ? "cal-grid" : undefined}>
          {home && view === "day" ? null : view === "day" ? (
            <DayTimeline
              date={date}
              occurrences={occurrences}
              categories={categories}
              ownerNames={ownerNames}
              onOpen={onOpen}
            />
          ) : view === "week" && !home ? (
            <WeekEvents
              days={days}
              occurrences={occurrences}
              categories={categories}
              ownerNames={ownerNames}
              onOpen={onOpen}
              today={today}
            />
          ) : (
            <nav
              aria-label={home && view === "week" ? "이번 주" : "달력"}
              data-od-id={home && view === "week" ? "week-strip" : undefined}
              className={cn(
                "mt-1 grid min-w-0 grid-cols-7",
                view === "month" && [
                  "[&>button]:min-h-14 lg:[&>button]:min-h-21",
                  "[&>button>span:nth-child(2)]:size-7.5",
                  "[&>button:nth-child(n+8)>span:first-child]:hidden",
                ],
              )}
            >
              {days.map((day) => (
                <CalendarDate
                  key={day.toISOString()}
                  day={day}
                  month={view === "month" ? selected.getMonth() : undefined}
                  selected={date}
                  today={today}
                  occurrences={occurrences}
                  categories={categories}
                  onSelect={onDateChange}
                />
              ))}
            </nav>
          )}
        </div>
        {(home || view === "month") && (
          <DayEvents
            date={date}
            today={today}
            home={home}
            occurrences={occurrences}
            categories={categories}
            ownerNames={ownerNames}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        )}
      </div>
      {!home && (
        <PrivateEventNotice occurrences={occurrences} ownerNames={ownerNames} />
      )}
    </div>
  );
}
export function CalendarView(props: CalendarProps) {
  return (
    <Suspense fallback={<ListSkeleton label="달력을 준비하고 있어요" />}>
      <CalendarContent {...props} />
    </Suspense>
  );
}
