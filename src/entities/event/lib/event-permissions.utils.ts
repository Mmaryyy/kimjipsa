import type { CalendarEvent, EventDetails } from "../api/type";
export type EventRecord = {
  id: string;
  owner_id: string | null;
  visibility: "shared" | "private";
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  event_details: {
    title: string;
    place: string;
    memo: string;
    category_id: string;
  } | null;
};
// Defense in depth: do not trust a supplied join to have enforced content RLS.
export function filterEventForRequester(
  event: EventRecord,
  requesterId: string,
): CalendarEvent {
  const canEdit =
    event.visibility === "shared" || event.owner_id === requesterId;
  let details: EventDetails | null = null;
  if (canEdit && event.event_details) {
    details = {
      title: event.event_details.title,
      place: event.event_details.place,
      memo: event.event_details.memo,
      categoryId: event.event_details.category_id,
    };
  }
  return {
    id: event.id,
    ownerId: event.owner_id,
    visibility: event.visibility,
    startDate: event.start_date,
    endDate: event.end_date,
    startTime: event.start_time?.slice(0, 5) ?? null,
    endTime: event.end_time?.slice(0, 5) ?? null,
    canChangeVisibility: event.owner_id === requesterId,
    isAllDay: event.is_all_day,
    canEdit,
    details,
  };
}
