"use client";
import { Suspense } from "react";
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
  calendarViews,
  kstDate,
  occurrencesInRange,
  EventOccurrenceRow,
  type CalendarView as View,
  type CalendarEvent,
  type EventCategory,
  type EventOccurrence,
} from "@/entities/event";
import {
  Button,
  CategoryDot,
  EmptyState,
  List,
  ListSkeleton,
  SegmentedControl,
  Text,
} from "@/shared/ui";
import {
  calendarDayStyles,
  calendarEventMarkerStyles,
} from "./calendar-day.variants";
import { useCalendarLocation } from "../model/use-calendar-location";
type CalendarProps = {
  events: CalendarEvent[];
  categories: EventCategory[];
  today: string;
  defaultView?: View;
  onOpen?: (id: string) => void;
};
function CalendarEventMarker({
  event,
  categories,
}: {
  event: CalendarEvent;
  categories: EventCategory[];
}) {
  const category = categories.find(
    (category) => category.id === event.details?.categoryId,
  );
  return (
    <div
      className={calendarEventMarkerStyles({ masked: event.details === null })}
    >
      {category && <CategoryDot color={category.color} />}
      <span className="truncate" title={category?.name}>
        {event.details?.title ?? "개인 일정"}
      </span>
    </div>
  );
}
function DayEvents({
  date,
  occurrences,
  categories,
  onOpen,
}: {
  date: string;
  occurrences: EventOccurrence[];
  categories: EventCategory[];
  onOpen?: (id: string) => void;
}) {
  const daily = occurrences.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
  return (
    <section aria-label={`${date} 일정`} className="min-w-0">
      <Text as="h3" variant="headline">
        {format(kstDate(date), "M월 d일 EEEE", { locale: ko })}
      </Text>
      {daily.length === 0 ? (
        <EmptyState message="이날은 일정이 없어요." />
      ) : (
        <List>
          {daily.map((occurrence) => (
            <EventOccurrenceRow
              key={occurrence.event.id}
              occurrence={occurrence}
              categories={categories}
              onOpen={onOpen}
            />
          ))}
        </List>
      )}
    </section>
  );
}
function CalendarContent({
  events,
  categories,
  today,
  defaultView = "week",
  onOpen,
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
    start = startOfWeek(selected);
    end = endOfWeek(selected);
  }
  const days = eachDayOfInterval({ start, end });
  const occurrences = occurrencesInRange(
    events,
    format(start, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );
  return (
    <section aria-label="달력" className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h2" variant="title-sm">
          {format(selected, "yyyy년 M월")}
        </Text>
        <SegmentedControl
          label="일정 보기"
          options={calendarViews}
          value={view}
          onValueChange={onViewChange}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="gray" size="sm" onClick={() => onMove(-1)}>
          이전
        </Button>
        <Button variant="gray" size="sm" onClick={() => onDateChange(today)}>
          오늘
        </Button>
        <Button variant="gray" size="sm" onClick={() => onMove(1)}>
          다음
        </Button>
        <label className="sr-only" htmlFor="calendar-date">
          선택 날짜
        </label>
        <input
          id="calendar-date"
          aria-label="선택 날짜"
          type="date"
          value={date}
          className="min-w-0"
          onChange={(event) => {
            if (event.target.value) onDateChange(event.target.value);
          }}
        />
      </div>
      {view === "month" ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid min-w-0 grid-cols-7 gap-1">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <Text
                key={day}
                className="text-center text-muted-foreground"
                variant="caption"
              >
                {day}
              </Text>
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const daily = occurrences.filter(
                (item) => item.startDate <= key && item.endDate >= key,
              );
              return (
                <div key={key} className="min-w-0 pb-3">
                  <Button
                    variant="gray"
                    size="sm"
                    className={calendarDayStyles({ selected: key === date })}
                    aria-label={`${key}${daily.length ? ` 일정 ${daily.length}개` : ""}`}
                    aria-pressed={key === date}
                    aria-current={key === today ? "date" : undefined}
                    onClick={() => onDateChange(key)}
                  >
                    {format(day, "d")}
                  </Button>
                  {daily.map(({ event }) => (
                    <CalendarEventMarker
                      key={event.id}
                      event={event}
                      categories={categories}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <DayEvents
            date={date}
            occurrences={occurrences}
            categories={categories}
            onOpen={onOpen}
          />
        </div>
      ) : (
        <div className="grid gap-6">
          {days.map((day) => (
            <DayEvents
              key={day.toISOString()}
              date={format(day, "yyyy-MM-dd")}
              occurrences={occurrences}
              categories={categories}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
      {occurrences.length === 0 && (
        <EmptyState message="선택한 기간에 일정이 없어요." />
      )}
    </section>
  );
}
export function CalendarView(props: CalendarProps) {
  return (
    <Suspense fallback={<ListSkeleton label="달력을 준비하고 있어요" />}>
      <CalendarContent {...props} />
    </Suspense>
  );
}
