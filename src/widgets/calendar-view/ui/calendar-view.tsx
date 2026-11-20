"use client";
import { resolveCategoryColor } from "@/shared/lib";
import {
  Suspense,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  type CalendarView as View,
  type CalendarEvent,
  type EventCategory,
  type EventOccurrence,
} from "@/entities/event";
import { useHolidays, type Holiday, type SpecialDay } from "@/entities/holiday";
import { TodoListRow, type Todo, type TodoActions } from "@/entities/todo";
import { eventRoutes } from "@/shared/config";
import { markHistoryBack, cn } from "@/shared/lib";
import {
  Button,
  EmptyState,
  List,
  ListRow,
  Skeleton,
  SkeletonSection,
  PageHeader,
  GroupLabel,
  SegmentedControl,
  SectionHeader,
  Sheet,
  Text,
  TextButton,
} from "@/shared/ui";
import {
  CalendarTodos,
  type CalendarTodoProps,
  type CalendarTodosByDate,
} from "./calendar-todos";
import { CalendarCarousel } from "./calendar-carousel";
import { calendarNumberStyles } from "./calendar-date.variants";
import { monthEventBarStyles } from "./month-event-bar.variants";
import {
  monthEventBars,
  monthEventDots,
  type MonthEventBar,
} from "../model/month-event-bars.utils";
import { useCalendarLocation } from "../model/use-calendar-location";
import {
  calendarTodayButtonStyles,
  dayEventListStyles,
  dayEventsStyles,
} from "./calendar-view.variants";

type CalendarProps = CalendarTodoProps & {
  loading?: boolean;
  events: CalendarEvent[];
  categories: EventCategory[];
  today: string;
  defaultView?: View;
  home?: boolean;
  ownerNames?: Record<string, string>;
  onOpen?: (id: string, action?: "edit" | "delete") => void;
  onAdd?: () => void;
  undatedTodosByDate?: CalendarTodosByDate;
  todoStatus?: ReactNode;
  todoActions?: TodoActions;
};

type DatePress = (date: string, button: HTMLButtonElement) => void;

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
  onSelect: DatePress;
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
        month !== undefined && "relative gap-[var(--calendar-date-gap)] pb-0",
      ])}
      onClick={(event) => onSelect(date, event.currentTarget)}
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
        {format(day, "EEEEE", { locale: ko })}
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
        {format(day, "d")}
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
          month !== undefined && [
            "relative w-full",
            "h-[calc(var(--spacing)*1.25+var(--calendar-bar-area)+var(--calendar-mark-gap)+var(--calendar-todo-height,0px))]",
          ],
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
                ? resolveCategoryColor(category.color)
                : "var(--sys-gray3)";
            return <i key={event.id} style={{ background: color }} />;
          })}
        </span>
        {month !== undefined && (
          <span
            className={cn([
              "absolute inset-x-0 bottom-0 block",
              "h-[var(--calendar-bar-area)]",
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
                  ? resolveCategoryColor(category.color)
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

type DayEventListProps = Pick<
  CalendarProps,
  | "categories"
  | "ownerNames"
  | "onOpen"
  | "todosByDate"
  | "undatedTodosByDate"
  | "todoActions"
  | "todoStatus"
  | "todoBusy"
> & {
  date: string;
  occurrences: EventOccurrence[];
  holiday?: Holiday;
  specialDays?: SpecialDay[];
  home?: boolean;
  emptyAction?: ReactNode;
  emptyMessage?: string;
};

function DayEventList({
  date,
  occurrences,
  categories,
  ownerNames,
  onOpen,
  holiday,
  specialDays,
  home = false,
  emptyAction,
  emptyMessage = "등록된 일정이 없어요",
  todosByDate,
  undatedTodosByDate,
  todoActions,
  todoStatus,
  todoBusy,
}: DayEventListProps) {
  const daily = occurrences.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
  const todos = [
    ...(todosByDate?.get(date) ?? []),
    ...(undatedTodosByDate?.get(date) ?? []),
  ].sort(
    (a, b) =>
      Number(Boolean(a.todo.completed_at)) -
        Number(Boolean(b.todo.completed_at)) ||
      (b.overdueDays ?? 0) - (a.overdueDays ?? 0) ||
      Number(!a.todo.due_on) - Number(!b.todo.due_on) ||
      a.todo.created_at.localeCompare(b.todo.created_at),
  );
  const todoRows =
    !todoStatus && todoActions
      ? todos.map(({ todo, overdueDays }) => (
          <TodoListRow
            key={todo.id}
            todo={todo}
            overdueDays={overdueDays}
            disabled={Boolean(todoBusy)}
            {...todoActions}
          />
        ))
      : [];
  return (
    <>
      {todoStatus}
      {Boolean(
        holiday || specialDays?.length || daily.length || todoRows.length,
      ) && (
        <List className={dayEventListStyles()}>
          {holiday && <HolidayRow holiday={holiday} />}
          <SpecialDayRows days={specialDays} />
          {todoRows}
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
      {!todoStatus && !todoRows.length && !daily.length && (
        <EmptyState
          layout="row"
          icon={null}
          message={emptyMessage}
          action={emptyAction}
        />
      )}
    </>
  );
}

function DayEvents({
  date,
  today,
  home,
  onAdd,
  ...listProps
}: DayEventListProps & {
  today: string;
  home: boolean;
  onAdd?: () => void;
}) {
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
      className={dayEventsStyles()}
      data-od-id={home ? "today-schedule" : "cal-day-list"}
    >
      <SectionHeader
        id={home ? "today-schedule-title" : "cal-list-title"}
        title={title}
        action={
          home ? (
            <Link
              className="text-caption text-primary"
              data-od-id="today-schedule-more"
              href={eventRoutes.calendar}
            >
              캘린더
            </Link>
          ) : (
            add
          )
        }
      />
      <DayEventList
        {...listProps}
        date={date}
        home={home}
        emptyAction={home ? add : undefined}
      />
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
  selected,
  onDatePress,
  loading = false,
  ...todoProps
}: CalendarTodoProps & {
  loading?: boolean;
  selected: string;
  onDatePress: DatePress;
  specialDays: Record<string, SpecialDay[]>;
  holidayNames: Record<string, string>;
  days: Date[];
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string, action?: "edit" | "delete") => void;
  today: string;
}) {
  return (
    <div>
      {days.map((day) => {
        const date = format(day, "yyyy-MM-dd");
        const daily = occurrences.filter(
          (item) => item.startDate <= date && item.endDate >= date,
        );
        const hasEntries = Boolean(
          daily.length ||
          holidayNames[date] ||
          specialDays[date]?.length ||
          todoProps.todosByDate?.get(date)?.length,
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
              <TextButton
                size={null}
                tone={null}
                className={cn(
                  "text-[length:var(--type-caption-size)] text-inherit",
                  date === selected && "underline underline-offset-4",
                )}
                aria-pressed={date === selected}
                onClick={(event) => onDatePress(date, event.currentTarget)}
              >
                {format(day, "M월 d일 EEEE", { locale: ko })}
                {holidayNames[date] && ` · ${holidayNames[date]}`}
                {date === today && " · 오늘"}
              </TextButton>
            </GroupLabel>
            {loading ? (
              <Skeleton className="h-32" />
            ) : hasEntries ? (
              <>
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
                <CalendarTodos date={date} {...todoProps} />
              </>
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
  onOpen?: (id: string, action?: "edit" | "delete") => void;
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
        ? resolveCategoryColor(category.color)
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
  ...todoProps
}: CalendarTodoProps & {
  holiday?: Holiday;
  specialDays?: SpecialDay[];
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  ownerNames?: Record<string, string>;
  onOpen?: (id: string, action?: "edit" | "delete") => void;
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
        {rows.map((row) => {
          const hasTodos =
            row.id === "all-day" && todoProps.todosByDate?.has(date);
          if (!hasTodos && !row.events.length && !row.id.startsWith("hour-"))
            return null;
          return (
            <li
              key={row.id}
              aria-hidden={
                !hasTodos && row.events.length === 0 ? true : undefined
              }
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
                {hasTodos && <CalendarTodos date={date} {...todoProps} />}
              </div>
            </li>
          );
        })}
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
  onDatePress,
  holidayNames,
  specialDays,
  holidaysPending,
  loading,
  ...todoProps
}: CalendarProps & {
  date: string;
  view: View;
  onDatePress: DatePress;
  holidayNames: Record<string, string>;
  specialDays: Record<string, SpecialDay[]>;
  holidaysPending: boolean;
}) {
  const selected = kstDate(date);
  const { start, end } = calendarRange(date, view);
  const days = eachDayOfInterval({ start, end });
  const occurrences = occurrencesInRange(
    loading ? [] : events,
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
  if (!home && (loading || holidaysPending) && view === "day") {
    return (
      <SkeletonSection label="하루 일정을 불러오고 있어요">
        <Skeleton className="mt-3 h-80" />
      </SkeletonSection>
    );
  }
  if (view === "day") {
    return (
      <DayTimeline
        {...todoProps}
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
    const week = (
      <WeekEvents
        {...todoProps}
        days={days}
        occurrences={occurrences}
        categories={categories}
        ownerNames={ownerNames}
        onOpen={onOpen}
        today={today}
        holidayNames={holidayNames}
        specialDays={specialDays}
        selected={date}
        onDatePress={onDatePress}
        loading={loading || holidaysPending}
      />
    );
    return loading || holidaysPending ? (
      <SkeletonSection label="이번 주 일정을 불러오고 있어요">
        {week}
      </SkeletonSection>
    ) : (
      week
    );
  }
  const dates = days.map((day) => format(day, "yyyy-MM-dd"));
  const showMonthTodos =
    view === "month" && dates.some((date) => todoProps.todosByDate?.has(date));
  return (
    <nav
      style={{ "--holiday-chars": 6 } as CSSProperties}
      aria-busy={loading || undefined}
      aria-label={home && view === "week" ? "이번 주" : "달력"}
      data-od-id={home && view === "week" ? "week-strip" : undefined}
      className={cn(
        "mt-1 grid min-w-0 grid-cols-7",
        view === "month" && [
          "[&>div>button]:min-h-14 lg:[&>div>button]:min-h-21",
          "[&>div:nth-child(n+8)>button>span:first-child]:hidden",
        ],
      )}
    >
      {days.map((day, index) => {
        const dayDate = dates[index];
        const control = (
          <CalendarDate
            key={dayDate}
            day={day}
            bars={bars.filter(
              (bar) => bar.startDate <= dayDate && bar.endDate >= dayDate,
            )}
            loading={loading}
            month={view === "month" ? selected.getMonth() : undefined}
            selected={date}
            today={today}
            occurrences={occurrences}
            categories={categories}
            onSelect={onDatePress}
            holidayName={holidayNames[dayDate]}
            specialDays={specialDays[dayDate]}
          />
        );
        return view === "month" ? (
          <div
            key={dayDate}
            data-od-id={`month-cell-${dayDate}`}
            className={cn(
              "relative grid min-w-0",
              "[--calendar-date-gap:var(--sp-1)]",
              "[--calendar-bar-height:calc(var(--spacing)*2)]",
              // 글자 안쪽 여백까지 포함한 보이는 간격에 막대 간격을 맞춘다.
              "[--calendar-mark-gap:calc(var(--calendar-date-gap)+var(--spacing)*0.25)]",
              "[--calendar-bar-area:calc(var(--calendar-bar-height)*2+var(--calendar-mark-gap))]",
              showMonthTodos && [
                "[--calendar-todo-height:calc(var(--spacing)*4)]",
                "[&>button]:justify-end",
              ],
            )}
          >
            {control}
            {todoProps.todosByDate?.has(dayDate) && (
              <div
                className={cn(
                  "absolute inset-x-0 min-w-0 overflow-hidden",
                  "bottom-[var(--calendar-bar-area)] h-[var(--calendar-todo-height)]",
                )}
              >
                <CalendarTodos date={dayDate} compact {...todoProps} />
              </div>
            )}
          </div>
        ) : (
          control
        );
      })}
    </nav>
  );
}

function CalendarDaySheet({
  date,
  events,
  loading,
  todoActions,
  onClose,
  restoreFocus,
  ...listProps
}: Omit<DayEventListProps, "occurrences"> &
  Pick<CalendarProps, "events" | "loading"> & {
    onClose: () => void;
    restoreFocus: () => void;
  }) {
  const occurrences = loading ? [] : occurrencesInRange(events, date, date);
  const sheetTodoActions = todoActions && {
    ...todoActions,
    onDelete: (todo: Todo) => {
      onClose();
      todoActions.onDelete(todo);
    },
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      title={format(kstDate(date), "M월 d일 EEEE", { locale: ko })}
      description="선택한 날짜의 일정과 할 일"
      odId="sheet-calendar-day"
    >
      {loading ? (
        <EventListSkeleton title="일정" />
      ) : (
        <DayEventList
          {...listProps}
          date={date}
          occurrences={occurrences}
          todoActions={sheetTodoActions}
          emptyMessage="일정과 할 일이 없어요"
        />
      )}
    </Sheet>
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
  undatedTodosByDate,
  todoStatus,
  todoActions,
  ...todoProps
}: CalendarProps) {
  const { view, date, onViewChange, onDateChange, onMove } =
    useCalendarLocation(defaultView, today);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const sheetTrigger = useRef<HTMLButtonElement | null>(null);
  const onDatePress: DatePress = (pressed, button) => {
    if (!home && pressed === date) {
      sheetTrigger.current = button;
      setSheetDate(pressed);
    } else {
      onDateChange(pressed);
    }
  };
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
        {...todoProps}
        loading={loading}
        events={events}
        categories={categories}
        today={today}
        home={home}
        ownerNames={ownerNames}
        onOpen={onOpen}
        date={panelDate}
        view={view}
        onDatePress={onDatePress}
        holidayNames={holidayNames}
        specialDays={specialDays}
        holidaysPending={panelHolidaysPending}
      />
    );
  };
  const selectedHoliday = holidayNames[date];
  const occurrences = occurrencesInRange(
    loading ? [] : events,
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
                  href={`${eventRoutes.categories}?from=calendar`}
                  onNavigate={() => {
                    markHistoryBack(eventRoutes.categories);
                  }}
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
                tone="muted"
                size="icon"
                aria-label={previousLabel}
                data-od-id="cal-prev"
                onClick={() => onMove(-1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </TextButton>
              <TextButton
                tone="muted"
                size={null}
                className={calendarTodayButtonStyles()}
                data-od-id="cal-today"
                onClick={() => onDateChange(today)}
              >
                오늘
              </TextButton>
              <TextButton
                tone="muted"
                size="icon"
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
            ? "grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr] lg:[&_[data-slot=section-header]]:mt-0"
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
        {!home && view !== "month" && todoStatus}
        {(home || view === "month") &&
        (loading || (!home && holidaysPending)) ? (
          <EventListSkeleton
            action={
              home ? (
                <Link
                  className="text-caption text-primary"
                  href={eventRoutes.calendar}
                >
                  캘린더
                </Link>
              ) : (
                <TextButton disabled>일정 등록</TextButton>
              )
            }
            title={
              home
                ? date === today
                  ? "오늘 일정"
                  : `${format(selected, "M월 d일")} 일정`
                : format(selected, "M월 d일 EEEE", { locale: ko })
            }
          />
        ) : (
          (home || view === "month") && (
            <DayEvents
              todosByDate={todoProps.todosByDate}
              undatedTodosByDate={undatedTodosByDate}
              todoBusy={todoProps.todoBusy}
              todoStatus={todoStatus}
              todoActions={todoActions}
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
      {sheetDate && (
        <CalendarDaySheet
          todosByDate={todoProps.todosByDate}
          undatedTodosByDate={undatedTodosByDate}
          todoBusy={todoProps.todoBusy}
          date={sheetDate}
          events={events}
          categories={categories}
          ownerNames={ownerNames}
          onOpen={onOpen}
          loading={loading || holidaysPending}
          holiday={
            holidayNames[sheetDate]
              ? { date: sheetDate, name: holidayNames[sheetDate] }
              : undefined
          }
          specialDays={specialDays[sheetDate]}
          todoStatus={todoStatus}
          todoActions={todoActions}
          restoreFocus={() =>
            sheetTrigger.current?.focus({ preventScroll: true })
          }
          onClose={() => setSheetDate(null)}
        />
      )}
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
