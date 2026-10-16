export const eventRoutes = {
  calendar: "/calendar",
  categories: "/settings/event-categories",
} as const;
export const eventApiRoutes = {
  events: "/api/events",
  categories: "/api/event-categories",
} as const;
export function eventApiPath(id: string) {
  return `${eventApiRoutes.events}/${encodeURIComponent(id)}`;
}
export function eventCategoryApiPath(id: string) {
  return `${eventApiRoutes.categories}/${encodeURIComponent(id)}`;
}
