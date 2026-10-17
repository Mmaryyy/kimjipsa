"use client";
import {
  useEvents,
  useEventCategories,
  useCalendarClock,
  eventDateInput,
  upcomingOccurrences,
} from "@/entities/event";
import { useHomeSettings } from "@/entities/user";
import { CalendarView } from "@/widgets/calendar-view";
import { ErrorState, ListSkeleton } from "@/shared/ui";
import { CelebrationCards } from "./celebration-cards";
import { DdayOverview } from "./dday-overview";
import { UpcomingEvents } from "./upcoming-events";
export function HomeSchedule() {
  const instant = useCalendarClock();
  const events = useEvents();
  const categories = useEventCategories();
  const settings = useHomeSettings();
  const failed = [events, categories, settings].find((query) => query.isError);
  if (failed?.error)
    return (
      <ErrorState
        message={failed.error.message}
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  if (
    events.isPending ||
    categories.isPending ||
    settings.isPending ||
    !events.data ||
    !categories.data ||
    !settings.data
  )
    return <ListSkeleton label="오늘 일정을 불러오고 있어요" />;
  return (
    <>
      <CelebrationCards events={events.data} instant={instant} />
      <div className="grid min-w-0 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <CalendarView
          events={events.data}
          categories={categories.data}
          today={eventDateInput(instant.toISOString())}
          defaultView={settings.data.homeView}
        />
        <div className="grid content-start gap-10">
          <DdayOverview
            events={events.data}
            categories={categories.data}
            instant={instant}
          />
          {settings.data.upcomingEnabled && (
            <UpcomingEvents
              occurrences={upcomingOccurrences(
                events.data,
                settings.data.upcomingCount,
                instant,
              )}
              categories={categories.data}
            />
          )}
        </div>
      </div>
    </>
  );
}
