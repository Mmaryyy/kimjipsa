"use client";
import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
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
  eventDayTimeLabel,
  calendarWeekTitle,
  occurrencesInRange,
  EventOccurrenceRow,
  EventListSkeleton,
  EventRowsSkeleton,
  type CalendarView as View,
  type CalendarEvent,
  type EventCategory,
  type EventOccurrence,
} from "@/entities/event";
import { useHolidays, type Holiday, type SpecialDay } from "@/entities/holiday";
import { eventRoutes } from "@/shared/config";
import { cn } from "@/shared/lib";
import {
  Button,
  categoryColors,
  EmptyState,
  List,
  ListRow,
  Skeleton,
  SkeletonSection,
  PageHeader,
  GroupLabel,
  SegmentedControl,
  SectionHeader,
  Text,
  TextButton,
} from "@/shared/ui";
import { CalendarCarousel } from "./calendar-carousel";
import { calendarNumberStyles } from "./calendar-date.variants";
import { monthEventBarStyles } from "./month-event-bar.variants";
import {
  monthEventBars,
  monthEventDots,
  type MonthEventBar,
} from "../model/month-event-bars.utils";
import { useCalendarLocation } from "../model/use-calendar-location";

type CalendarProps = {
  loading?: boolean;
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
  outside,
  sunday,
  saturday,
  holiday,
}: {
  saturday: boolean;
  outside: boolean;
  sunday: boolean;
  holiday: boolean;
}) {
  if (outside) return "outside";
  if (holiday) return "sunday";
  if (sunday) return "sunday";
  if (saturday) return "saturday";
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
  holidayName,
  specialDays = [],
  loading,
  bars = [],
}: {
  bars?: MonthEventBar[];
  day: Date;
  selected: string;
  today: string;
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  onSelect: (date: string) => void;
  month?: number;
  holidayName?: string;
  specialDays?: SpecialDay[];
  loading?: boolean;
}) {
  const date = format(day, "yyyy-MM-dd");
  const daily = occurrences.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
  const dots = month === undefined ? daily : monthEventDots(daily, bars);
  const isToday = date === today;
  const isSelected = date === selected;
  const outside = month !== undefined && day.getMonth() !== month;
  const numberTone = getCalendarNumberTone({
    saturday: day.getDay() === 6,
    outside,
    sunday: day.getDay() === 0,
    holiday: Boolean(holidayName),
  });
  const weekdayTone = getCalendarNumberTone({
    outside: false,
    holiday: false,
    sunday: day.getDay() === 0,
    saturday: day.getDay() === 6,
  });
  const specialDayNames = specialDays.map((day) => day.name).join(" · ");
  const holidayLabel = (holidayName || specialDayNames).replace(/\s/g, "");
  const accessibleLabel = [
    format(day, "M월 d일 EEEE", { locale: ko }),
    !loading && `일정 ${daily.length}개`,
    holidayName,
    specialDayNames,
    isToday && "오늘",
    isSelected && "선택됨",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <TextButton
      className={cn([
        "group/calendar-date @container flex min-w-0 flex-col gap-1",
        "px-0 pt-2 pb-2.5 text-foreground outline-none",
        month !== undefined && [
          "relative gap-[var(--calendar-date-gap)] pb-0",
          "[--calendar-date-gap:var(--sp-1)]",
          "[--calendar-bar-height:calc(var(--spacing)*2)]",
          // 글자 안쪽 여백까지 포함한 보이는 간격에 막대 간격을 맞춘다.
          "[--calendar-mark-gap:calc(var(--calendar-date-gap)+var(--spacing)*0.25)]",
        ],
      ])}
      onClick={() => onSelect(date)}
      data-od-id={`${month !== undefined ? "month" : "week"}-day-${date}`}
      data-outside={month !== undefined && day.getMonth() !== month}
      data-today={isToday}
      data-selected={isSelected}
      data-sunday={day.getDay() === 0}
      data-holiday={Boolean(holidayName)}
      aria-label={accessibleLabel}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
    >
      {/* 일자 */}
      <span
        className={cn(
          [
            "text-[length:var(--type-caption-sm-size)] font-normal",
            "tracking-[var(--type-caption-sm-tracking)]",
          ],
          {
            default: "text-muted-foreground",
            outside: "text-[var(--label-tertiary)]",
            saturday: "text-[var(--accent-text)]",
            sunday: "text-[var(--sys-red-ic)]",
          }[weekdayTone],
        )}
      >
        {loading ? (
          <Skeleton className="h-3 w-3" />
        ) : (
          format(day, "EEEEE", { locale: ko })
        )}
      </span>
      <span
        className={cn(
          calendarNumberStyles({
            tone: numberTone,
            selected: isSelected,
            today: isToday,
          }),
          month !== undefined && "shrink-0 leading-none",
        )}
      >
        {loading ? <Skeleton className="h-5 w-5" /> : format(day, "d")}
      </span>
      {month !== undefined && (
        <span
          className={cn(
            "block h-[1em] w-full shrink-0 truncate text-center",
            "max-w-[calc(var(--holiday-chars)*0.87em)]",
            "tracking-normal",
            // 스위트 한글 폭(약 0.86em)에 여유를 두고 기본 자간으로 6글자를 맞춘다.
            "text-[length:clamp(9px,calc(100cqi/var(--holiday-chars)/0.87),11px)]",
            "leading-none",
            outside
              ? "text-[var(--label-tertiary)]"
              : holidayName
                ? "text-[var(--sys-red-ic)]"
                : "text-[var(--label-secondary)]",
          )}
          aria-hidden="true"
        >
          {holidayLabel}
        </span>
      )}
      <span
        className={cn(
          "flex shrink-0 flex-col items-center",
          month !== undefined &&
            "relative h-[calc(var(--spacing)*1.25+var(--calendar-bar-height)*2+var(--calendar-mark-gap)*2)] w-full",
        )}
      >
        <span
          className="flex h-1.25 gap-0.75 [&_i]:size-1.25 [&_i]:rounded-[var(--r-round)]"
          aria-hidden="true"
        >
          {dots.slice(0, 3).map(({ event }) => {
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
        {month !== undefined && (
          <span
            className={cn([
              "absolute inset-x-0 bottom-0 block",
              "h-[calc(var(--calendar-bar-height)*2+var(--calendar-mark-gap))]",
            ])}
            aria-hidden="true"
          >
            {bars.map((bar) => {
              const { event } = bar.occurrence;
              const category = categories.find(
                (category) => category.id === event.details?.categoryId,
              );
              const color =
                event.visibility !== "private" && category
                  ? categoryColors[category.color]
                  : "var(--sys-gray3)";
              return (
                <i
                  key={event.id}
                  data-slot="month-event-bar"
                  data-lane={bar.lane}
                  className={monthEventBarStyles({
                    start: bar.startsHere && date === bar.startDate,
                    end: bar.endsHere && date === bar.endDate,
                    lane: bar.lane,
                  })}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </span>
        )}
      </span>
    </TextButton>
  );
}

function AllDayTime({ timeline = false }: { timeline?: boolean }) {
  return (
    <Text
      aria-hidden="true"
      variant="caption"
      className={cn(
        "w-[60px] shrink-0 text-muted-foreground tabular-nums",
        timeline && "w-13 pt-0.5 text-caption-sm text-[var(--label-tertiary)]",
      )}
    >
      종일
    </Text>
  );
}

function HolidayRow({
  holiday,
  className,
  timeline,
}: {
  holiday: Holiday;
  className?: string;
  timeline?: boolean;
}) {
  return (
    <ListRow
      aria-label={`${holiday.name}, 공휴일`}
      className={className}
      leading={
        <>
          <AllDayTime timeline={timeline} />
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full bg-[var(--sys-red-ic)]"
          />
        </>
      }
      description="공휴일"
    >
      <Text className="text-[var(--sys-red-ic)]">{holiday.name}</Text>
    </ListRow>
  );
}

function SpecialDayRow({
  day,
  timeline,
}: {
  day: SpecialDay;
  timeline: boolean;
}) {
  const label = `${day.name} · ${day.kind === "solarTerm" ? "절기" : "잡절"}`;
  return (
    <ListRow
      aria-label={label}
      className={cn(
        "text-[var(--label-secondary)]",
        timeline && "items-start py-[9px]",
      )}
      leading={
        <>
          <AllDayTime timeline={timeline} />
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full bg-[var(--label-secondary)]"
          />
        </>
      }
    >
      <Text className="text-[var(--label-secondary)]">{label}</Text>
    </ListRow>
  );
}

function SpecialDayRows({
  days = [],
  timeline = false,
}: {
  days?: SpecialDay[];
  timeline?: boolean;
}) {
  return days.map((day) => (
    <SpecialDayRow
      key={`${day.kind}:${day.name}`}
      day={day}
      timeline={timeline}
    />
  ));
}

function DayEvents({
  holiday,
  specialDays,
  date,
  today,
  home,
  occurrences,
  categories,
  ownerNames,
  onOpen,
  onAdd,
}: {
  holiday?: Holiday;
  specialDays?: SpecialDay[];
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
      일정 등록
    </TextButton>
  ) : (
    <Link
      className="text-primary text-caption"
      data-od-id="day-add"
      href={`${eventRoutes.calendar}?date=${date}&create=1`}
    >
      일정 등록
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
      {(holiday || (!home && specialDays && specialDays.length > 0)) && (
        <List>
          {holiday && <HolidayRow holiday={holiday} />}
          {!home && <SpecialDayRows days={specialDays} />}
        </List>
      )}
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
  holidayNames,
  specialDays,
}: {
  specialDays: Record<string, SpecialDay[]>;
  holidayNames: Record<string, string>;
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
          <section
            key={date}
            aria-label={[
              date,
              holidayNames[date],
              ...(specialDays[date] ?? []).map((day) => day.name),
            ]
              .filter(Boolean)
              .join(", ")}
          >
            <GroupLabel
              as="h3"
              className={cn(
                date === today && "font-bold text-foreground",
                day.getDay() === 6 && "text-[var(--accent-text)]",
                (day.getDay() === 0 || holidayNames[date]) &&
                  "text-[var(--sys-red-ic)]",
              )}
            >
              {format(day, "M월 d일 EEEE", { locale: ko })}
              {holidayNames[date] && ` · ${holidayNames[date]}`}
              {date === today && " · 오늘"}
            </GroupLabel>
            {daily.length || holidayNames[date] || specialDays[date]?.length ? (
              <List>
                {holidayNames[date] && (
                  <HolidayRow holiday={{ date, name: holidayNames[date] }} />
                )}
                <SpecialDayRows days={specialDays[date]} />
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
  date,
}: {
  occurrence: EventOccurrence;
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  showTime: boolean;
  date: string;
}) {
  const { event, dday } = occurrence;
  const time = eventDayTimeLabel(event, date);
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
        className="size-2.5 shrink-0 rounded-full"
        style={
          masked
            ? { boxShadow: "inset 0 0 0 1.5px var(--sys-gray3)" }
            : { backgroundColor: color }
        }
      />
      <span className="min-w-0 break-words">
        {masked ? (
          <>
            {showTime && `${time} `}
            개인 일정{owner && ` · ${owner} 님`}
          </>
        ) : (
          <>
            {showTime && `${time} `}
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
  holiday,
  specialDays,
  date,
  occurrences,
  categories,
  ownerNames,
  onOpen,
}: {
  holiday?: Holiday;
  specialDays?: SpecialDay[];
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string) => void;
  date: string;
}) {
  const timeOf = ({ event, dday }: EventOccurrence) =>
    dday ? "종일" : eventDayTimeLabel(event, date);
  const slotTime = (occurrence: EventOccurrence) =>
    timeOf(occurrence).replace("~", "");
  const allDay = occurrences.filter((item) => timeOf(item) === "종일");
  const undetermined = occurrences.filter(
    (item) => timeOf(item) === "시간 미정",
  );
  const timed = occurrences.filter(
    (item) => timeOf(item) !== "종일" && timeOf(item) !== "시간 미정",
  );
  const hours = Array.from({ length: 15 }, (_, index) =>
    String(8 + index).padStart(2, "0"),
  );
  const rows = [
    { id: "all-day", label: "종일", events: allDay, showTime: false },
    {
      id: "before-hours",
      label: "08:00 이전",
      events: timed.filter((item) => slotTime(item) < "08:00"),
      showTime: true,
    },
    ...hours.map((hour) => ({
      id: `hour-${hour}`,
      label: `${hour}:00`,
      events: timed.filter((item) => slotTime(item).startsWith(hour)),
      showTime: true,
    })),
    {
      id: "after-hours",
      label: "23:00 이후",
      events: timed.filter((item) => slotTime(item) >= "23:00"),
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
      <ul className="mt-3">
        {holiday && (
          <HolidayRow
            holiday={holiday}
            className="items-start py-[9px]"
            timeline
          />
        )}
        <SpecialDayRows days={specialDays} timeline />
        <li className={cn("py-[9px]", occurrences.length > 0 && "sr-only")}>
          <Text as="p" variant="caption" className="text-muted-foreground">
            {occurrences.length > 0
              ? `일정 ${occurrences.length}개`
              : "등록된 일정이 없어요"}
          </Text>
        </li>
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
                    date={date}
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

function calendarRange(date: string, view: View) {
  const selected = kstDate(date);
  if (view === "month")
    return {
      start: startOfWeek(startOfMonth(selected)),
      end: endOfWeek(endOfMonth(selected)),
    };
  if (view === "week")
    return { start: startOfWeek(selected), end: endOfWeek(selected) };
  return { start: selected, end: selected };
}

function CalendarPanel({
  events,
  categories,
  today,
  home = false,
  ownerNames,
  onOpen,
  date,
  view,
  onDateChange,
  holidayNames,
  specialDays,
  holidaysPending,
  loading,
}: CalendarProps & {
  date: string;
  view: View;
  onDateChange: (date: string) => void;
  holidayNames: Record<string, string>;
  specialDays: Record<string, SpecialDay[]>;
  holidaysPending: boolean;
}) {
  const selected = kstDate(date);
  const { start, end } = calendarRange(date, view);
  const days = eachDayOfInterval({ start, end });
  const occurrences = occurrencesInRange(
    events,
    format(start, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );
  const bars =
    view === "month" && !loading
      ? monthEventBars(
          occurrences,
          format(start, "yyyy-MM-dd"),
          format(end, "yyyy-MM-dd"),
        )
      : [];
  const selectedHoliday = holidayNames[date];
  if (home && view === "day") return null;
  if (!home && (loading || holidaysPending) && view === "week") {
    return (
      <SkeletonSection label="이번 주 일정을 불러오고 있어요">
        {days.map((day) => (
          <div key={day.toISOString()}>
            <GroupLabel as="h3">
              {format(day, "M월 d일 EEEE", { locale: ko })}
            </GroupLabel>
            <EventRowsSkeleton rows={1} interactive />
          </div>
        ))}
      </SkeletonSection>
    );
  }
  if (!home && (loading || holidaysPending) && view === "day") {
    return (
      <SkeletonSection label="하루 일정을 불러오고 있어요">
        <ul className="mt-3">
          {Array.from({ length: 15 }, (_, index) => (
            <li
              key={index}
              className="flex min-h-12 items-start gap-3 py-[9px]"
            >
              <Text
                variant="caption-sm"
                className="w-13 shrink-0 pt-0.5 text-[var(--label-tertiary)]"
              >
                {String(index + 8).padStart(2, "0")}:00
              </Text>
              <Skeleton className="mt-1 h-4 w-32" />
            </li>
          ))}
        </ul>
      </SkeletonSection>
    );
  }
  if (view === "day") {
    return (
      <DayTimeline
        specialDays={specialDays[date]}
        holiday={selectedHoliday ? { date, name: selectedHoliday } : undefined}
        date={date}
        occurrences={occurrences}
        categories={categories}
        ownerNames={ownerNames}
        onOpen={onOpen}
      />
    );
  }
  if (view === "week" && !home) {
    return (
      <WeekEvents
        days={days}
        occurrences={occurrences}
        categories={categories}
        ownerNames={ownerNames}
        onOpen={onOpen}
        today={today}
        holidayNames={holidayNames}
        specialDays={specialDays}
      />
    );
  }
  return (
    <nav
      style={{ "--holiday-chars": 6 } as CSSProperties}
      aria-busy={loading || undefined}
      aria-label={home && view === "week" ? "이번 주" : "달력"}
      data-od-id={home && view === "week" ? "week-strip" : undefined}
      className={cn(
        "mt-1 grid min-w-0 grid-cols-7",
        view === "month" && [
          "[&>button]:min-h-14 lg:[&>button]:min-h-21",
          "[&>button:nth-child(n+8)>span:first-child]:hidden",
        ],
      )}
    >
      {days.map((day) => (
        <CalendarDate
          key={day.toISOString()}
          day={day}
          bars={bars.filter(
            (bar) =>
              bar.startDate <= format(day, "yyyy-MM-dd") &&
              bar.endDate >= format(day, "yyyy-MM-dd"),
          )}
          loading={loading}
          month={view === "month" ? selected.getMonth() : undefined}
          selected={date}
          today={today}
          occurrences={occurrences}
          categories={categories}
          onSelect={onDateChange}
          holidayName={holidayNames[format(day, "yyyy-MM-dd")]}
          specialDays={specialDays[format(day, "yyyy-MM-dd")]}
        />
      ))}
    </nav>
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
  loading,
}: CalendarProps) {
  const { view, date, onViewChange, onDateChange, onMove } =
    useCalendarLocation(defaultView, today);
  const selected = kstDate(date);
  const { start, end } = calendarRange(date, view);
  const move = { month: addMonths, week: addWeeks, day: addDays }[view];
  const previousRange = calendarRange(
    format(move(selected, -1), "yyyy-MM-dd"),
    view,
  );
  const nextRange = calendarRange(
    format(move(selected, 1), "yyyy-MM-dd"),
    view,
  );
  const {
    names: holidayNames,
    specialDays = {},
    isPending,
    pendingYears,
  } = useHolidays(
    (home ? start : previousRange.start).getFullYear(),
    (home ? end : nextRange.end).getFullYear(),
  );
  // Neighbor years warm the query cache without blocking the current calendar.
  const holidaysPending = pendingYears
    ? pendingYears.some(
        (year) => year >= start.getFullYear() && year <= end.getFullYear(),
      )
    : isPending;
  // useEvents already supplies all periods from the same TanStack Query cache.
  const renderPanel = (panelDate: string) => {
    const range = calendarRange(panelDate, view);
    const panelHolidaysPending = pendingYears
      ? pendingYears.some(
          (year) =>
            year >= range.start.getFullYear() &&
            year <= range.end.getFullYear(),
        )
      : isPending;
    return (
      <CalendarPanel
        loading={loading}
        events={events}
        categories={categories}
        today={today}
        home={home}
        ownerNames={ownerNames}
        onOpen={onOpen}
        date={panelDate}
        view={view}
        onDateChange={onDateChange}
        holidayNames={holidayNames}
        specialDays={specialDays}
        holidaysPending={panelHolidaysPending}
      />
    );
  };
  const selectedHoliday = holidayNames[date];
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
  const title =
    view === "day"
      ? format(selected, "M월 d일 EEEE", { locale: ko })
      : view === "week"
        ? calendarWeekTitle(date)
        : format(selected, "yyyy년 M월");
  const previousLabel = { month: "이전 달", week: "이전 주", day: "전날" }[
    view
  ];
  const nextLabel = { month: "다음 달", week: "다음 주", day: "다음 날" }[view];
  return (
    <div className="min-w-0">
      {!home && (
        <PageHeader
          odId="calendar"
          titleOdId="cal-title"
          title={title}
          titleAriaLabel={view === "week" ? title : undefined}
          actions={
            <>
              <Button variant="glass" data-od-id="cal-add" onClick={onAdd}>
                등록
              </Button>
              <Button variant="glass" asChild>
                <Link
                  href={eventRoutes.categories}
                  aria-label="일정 카테고리 설정"
                >
                  설정
                </Link>
              </Button>
            </>
          }
        >
          <span role="status" className="sr-only" aria-atomic="true">
            {title}
          </span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <SegmentedControl
              odId="cal-view"
              label="보기"
              options={options}
              value={view}
              onValueChange={onViewChange}
            />
            <div className="flex shrink-0 items-center">
              <TextButton
                className="size-11 text-muted-foreground [&_svg]:text-[var(--icon-secondary)]"
                aria-label={previousLabel}
                data-od-id="cal-prev"
                onClick={() => onMove(-1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </TextButton>
              <TextButton
                className="min-h-11 min-w-11 text-muted-foreground"
                data-od-id="cal-today"
                onClick={() => onDateChange(today)}
              >
                오늘
              </TextButton>
              <TextButton
                className="size-11 text-muted-foreground [&_svg]:text-[var(--icon-secondary)]"
                aria-label={nextLabel}
                data-od-id="cal-next"
                onClick={() => onMove(1)}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </TextButton>
            </div>
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
        <div className="min-w-0" data-od-id={!home ? "cal-grid" : undefined}>
          {home ? (
            renderPanel(date)
          ) : (
            <CalendarCarousel
              date={date}
              view={view}
              onDateChange={onDateChange}
              renderPanel={renderPanel}
            />
          )}
        </div>
        {(home || view === "month") &&
        (loading || (!home && holidaysPending)) ? (
          <EventListSkeleton
            interactive={!home}
            title={
              home
                ? "오늘 일정"
                : format(selected, "M월 d일 EEEE", { locale: ko })
            }
          />
        ) : (
          (home || view === "month") && (
            <DayEvents
              specialDays={home ? undefined : specialDays[date]}
              holiday={
                !home && selectedHoliday
                  ? { date, name: selectedHoliday }
                  : undefined
              }
              date={date}
              today={today}
              home={home}
              occurrences={occurrences}
              categories={categories}
              ownerNames={ownerNames}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          )
        )}
      </div>
    </div>
  );
}
export function CalendarView(props: CalendarProps) {
  return (
    <Suspense fallback={<EventListSkeleton title="일정" />}>
      <CalendarContent {...props} />
    </Suspense>
  );
}
