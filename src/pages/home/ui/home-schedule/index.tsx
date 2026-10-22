"use client";

import {
  DdayOverview,
  EventListSkeleton,
  eventDateInput,
  kstDate,
  upcomingOccurrences,
  useCalendarClock,
  useEventCategories,
  useEvents,
} from "@/entities/event";
import { ErrorState, PageHeader, SectionHeader, Text } from "@/shared/ui";

import { CalendarView } from "@/widgets/calendar-view";
import CelebrationCardList from "../celebration-card-list";
import { NotificationBell } from "@/entities/notification";
import UpcomingEvents from "../upcoming-events";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useFamily } from "@/features/family";
import { useHomeSettings } from "@/entities/user";

const HomeSchedule = () => {
  const instant = useCalendarClock();
  const events = useEvents();
  const categories = useEventCategories();
  const settings = useHomeSettings();
  const family = useFamily();
  const failed = [events, categories, settings, family].find(
    (query) => query.isError,
  );

  if (failed?.error)
    return (
      <ErrorState
        message={failed.error.message}
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );

  const loading = events.isPending || categories.isPending || family.isPending;
  const homeSettings = settings.data ?? {
    homeView: "week",
    upcomingEnabled: true,
    upcomingCount: 5,
  };
  const today = eventDateInput(instant.toISOString());
  const dateLabel = format(kstDate(today), "M월 d일 EEEE", { locale: ko });
  const subtitle = family.data?.name
    ? `${dateLabel} · ${family.data.name}`
    : dateLabel;
  const ownerNames = Object.fromEntries(
    (family.data?.members ?? []).map((member) => [
      member.user_id,
      member.display_name,
    ]),
  );

  return (
    <>
      <PageHeader
        odId="home"
        title="오늘"
        subtitle={subtitle}
        actions={<NotificationBell />}
      />
      {events.data && (
        <CelebrationCardList events={events.data} instant={instant} />
      )}
      <div className="grid min-w-0 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <CalendarView
            home
            loading={loading || settings.isPending}
            ownerNames={ownerNames}
            events={events.data ?? []}
            categories={categories.data ?? []}
            today={eventDateInput(instant.toISOString())}
            defaultView={homeSettings.homeView}
          />
          {homeSettings.upcomingEnabled &&
            (loading || settings.isPending ? (
              <EventListSkeleton
                title="다가오는 일정"
                grouped
                rows={homeSettings.upcomingCount}
              />
            ) : (
              <UpcomingEvents
                occurrences={upcomingOccurrences(
                  events.data ?? [],
                  homeSettings.upcomingCount,
                  instant,
                )}
                categories={categories.data ?? []}
                ownerNames={ownerNames}
                count={homeSettings.upcomingCount}
              />
            ))}
        </div>
        <div className="grid content-start gap-10">
          {loading ? (
            <EventListSkeleton title="D-day" dday />
          ) : (
            <DdayOverview
              events={events.data ?? []}
              categories={categories.data ?? []}
              instant={instant}
            />
          )}
          <section data-od-id="stock-summary" aria-labelledby="stock-title">
            <SectionHeader id="stock-title" title="확인할 재고" />
            <Text as="p" variant="caption" className="text-muted-foreground">
              준비 중이에요.
            </Text>
          </section>
          <section data-od-id="cart-summary" aria-labelledby="cart-title">
            <SectionHeader id="cart-title" title="장바구니" />
            <Text as="p" variant="caption" className="text-muted-foreground">
              준비 중이에요.
            </Text>
          </section>
        </div>
      </div>
    </>
  );
};

export default HomeSchedule;
