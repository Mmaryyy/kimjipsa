import type { z } from "zod";
import type { eventSchema, eventCategorySchema } from "../model/event.schema";
import type {
  eventCategoryColors,
  eventVisibility,
} from "../model/event.constants";
export type EventInput = z.infer<typeof eventSchema>;
export type EventCategoryInput = z.infer<typeof eventCategorySchema>;
export type EventCategory = EventCategoryInput & { id: string };
export type EventDetails = {
  ddayStyle: "normal" | "celebrate";
  celebrateMessage: string;
  title: string;
  place: string;
  memo: string;
  categoryId: string;
};
export type CalendarEvent = {
  remindBefore?: EventInput["remindBefore"];
  kind: "event" | "dday";
  id: string;
  ownerId: string | null;
  visibility: keyof typeof eventVisibility;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  canChangeVisibility: boolean;
  isAllDay: boolean;
  canEdit: boolean;
  details: EventDetails | null;
};
export type EventCategoryColor = keyof typeof eventCategoryColors;
