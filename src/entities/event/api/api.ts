import { request } from "@/shared/api";
import {
  eventApiRoutes,
  eventApiPath,
  eventCategoryApiPath,
} from "@/shared/config";
import type {
  CalendarEvent,
  EventCategory,
  EventInput,
  EventCategoryInput,
} from "./type";
export function fetchEvents() {
  return request<CalendarEvent[]>(eventApiRoutes.events);
}
export function fetchEvent(id: string) {
  return request<CalendarEvent | null>(eventApiPath(id));
}
export function saveEvent(input: EventInput, id?: string) {
  return request<string>(id ? eventApiPath(id) : eventApiRoutes.events, input);
}
export function deleteEvent(id: string) {
  return request<null>(`${eventApiPath(id)}/delete`, {});
}
export function fetchCategories() {
  return request<EventCategory[]>(eventApiRoutes.categories);
}
export function saveCategory(input: EventCategoryInput, id?: string) {
  return request<string>(
    id ? eventCategoryApiPath(id) : eventApiRoutes.categories,
    input,
  );
}
export function deleteCategory(id: string) {
  return request<null>(`${eventCategoryApiPath(id)}/delete`, {});
}
