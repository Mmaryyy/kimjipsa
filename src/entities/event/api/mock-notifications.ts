import "server-only";
import { mockContext, mockJson } from "@/shared/server";
export async function notifyMockEventChange(
  event: { id: string; visibility: string },
  kind: "event_created" | "event_updated" | "event_deleted",
  title: string,
  occurrenceDate?: string,
) {
  const context = await mockContext();
  if (!context) return;
  const notifications = await mockJson("notifications");
  if (kind === "event_deleted") {
    for (const entry of notifications)
      if (
        entry.payload.eventId === event.id &&
        (!occurrenceDate || entry.payload.occurrenceDate === occurrenceDate)
      )
        entry.payload.eventDeleted = true;
  }
  if (event.visibility !== "shared") {
    for (const entry of notifications)
      if (entry.payload.eventId === event.id) {
        delete entry.payload.eventTitle;
      }
    return;
  }
  const family = await mockJson("family");
  const actor = family.members[context.perspective]!;
  for (const member of family.members) {
    if (member.user_id === actor.user_id) continue;
    notifications.push({
      id: crypto.randomUUID(),
      user_id: member.user_id,
      family_id: family.id,
      kind,
      payload: {
        eventId: event.id,
        ...(occurrenceDate ? { occurrenceDate } : {}),
        eventDeleted: kind === "event_deleted",
        eventTitle: title,
        actorName: actor.display_name,
      },
      read_at: null,
      created_at: new Date().toISOString(),
    });
  }
}
