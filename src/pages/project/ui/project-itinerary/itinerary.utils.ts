import { tz } from "@date-fns/tz";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { ProjectDetail } from "@/entities/project";

const seoul = tz("Asia/Seoul");

export function itineraryTimeline({
  itinerary,
  reservations,
}: Pick<ProjectDetail, "itinerary" | "reservations">) {
  if (!itinerary.length) return { days: [], reservationCount: 0 };

  const items = itinerary.toSorted((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );
  const start = items[0].starts_on;
  const end = items.reduce((latest, row) => {
    const finish = row.ends_on ?? row.starts_on;
    return finish > latest ? finish : latest;
  }, start);
  const stays = reservations.filter(
    (row) =>
      row.status !== "cancelled" &&
      row.starts_on &&
      row.starts_on >= start &&
      row.starts_on <= end,
  );
  const itemsByDate = Map.groupBy(items, (row) => row.starts_on);
  const staysByDate = Map.groupBy(stays, (row) => row.starts_on);
  const dates = eachDayOfInterval({
    start: parseISO(start, { in: seoul }),
    end: parseISO(end, { in: seoul }),
  });
  const days = dates.map((day) => {
    const date = format(day, "yyyy-MM-dd");
    const entries = itemsByDate.get(date) ?? [];
    const bookings = staysByDate.get(date) ?? [];
    const empty = entries.length === 0 && bookings.length === 0;
    const continued = empty
      ? items.findLast(
          (row) => row.starts_on < date && row.ends_on && row.ends_on >= date,
        )
      : undefined;
    return { date, day, entries, bookings, empty, continued };
  });

  return { days, reservationCount: stays.length };
}
