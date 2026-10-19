"use client";
import {
  kstDate,
  useEvents,
  useEventCategories,
  useCalendarClock,
  eventDateInput,
  upcomingOccurrences,
} from "@/entities/event";
import { useFamily } from "@/features/family";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useHomeSettings } from "@/entities/user";
import { CalendarView } from "@/widgets/calendar-view";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionHeader,
  Text,
} from "@/shared/ui";
import { CelebrationCards } from "./celebration-cards";
import { DdayOverview } from "./dday-overview";
import { UpcomingEvents } from "./upcoming-events";
export function HomeSchedule() {
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
  if (
    family.isPending ||
    events.isPending ||
    categories.isPending ||
    settings.isPending ||
    !events.data ||
    !categories.data ||
    !settings.data
  )
    return <ListSkeleton label="오늘 일정을 불러오고 있어요" />;
  const today = eventDateInput(instant.toISOString());
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
        titleVariant="display"
        title="오늘"
        subtitle={`${format(kstDate(today), "M월 d일 EEEE", { locale: ko })} · ${family.data?.name ?? ""}`}
      />
      <CelebrationCards events={events.data} instant={instant} />
      <div className="grid min-w-0 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <CalendarView
            home
            ownerNames={ownerNames}
            events={events.data}
            categories={categories.data}
            today={eventDateInput(instant.toISOString())}
            defaultView={settings.data.homeView}
          />
          {settings.data.upcomingEnabled && (
            <UpcomingEvents
              occurrences={upcomingOccurrences(
                events.data,
                settings.data.upcomingCount,
                instant,
              )}
              categories={categories.data}
              ownerNames={ownerNames}
              count={settings.data.upcomingCount}
            />
          )}
        </div>
        <div className="grid content-start gap-10">
          <DdayOverview
            events={events.data}
            categories={categories.data}
            instant={instant}
          />
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
}
