import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  throwDatabaseError,
} from "@/shared/server";
import { eventSchema, eventCategorySchema } from "../model/event.schema";
import { filterEventForRequester } from "../lib/event-permissions.utils";
import type { EventRecord } from "../lib/event-permissions.utils";
import type { CalendarEvent, EventCategory } from "./type";
const errors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  event_not_found: [404, "일정을 찾을 수 없어요."],
  event_forbidden: [403, "작성자만 변경할 수 있어요."],
  invalid_event: [400, "일정 내용을 확인해 주세요."],
  category_not_found: [404, "카테고리를 다시 선택해 주세요."],
  invalid_category: [400, "카테고리를 확인해 주세요."],
  category_duplicate: [409, "같은 이름의 카테고리가 있어요."],
  fallback_category: [409, "기타 카테고리는 이름을 바꾸거나 삭제할 수 없어요."],
} as const;
type AuthContext = { client: SupabaseClient<Database>; user: { id: string } };
const idSchema = z.uuid("요청 주소를 확인해 주세요.");
async function eventContext(auth?: AuthContext) {
  const client = auth?.client ?? (await createServerSupabaseClient());
  const {
    data: { user },
    error,
  } = auth
    ? { data: { user: auth.user }, error: null }
    : await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error, errors);
  if (!membership.data)
    throw new ApiError("family_required", "가정에 먼저 참여해 주세요.", 403);
  return { client, userId: user.id, familyId: membership.data.family_id };
}
const selection =
  "id, owner_id, visibility, start_date, end_date, start_time, end_time, is_all_day, event_details(title, place, memo, category_id)";
const recordSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid().nullable(),
  visibility: z.enum(["shared", "private"]),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  is_all_day: z.boolean(),
  event_details: z
    .object({
      title: z.string(),
      place: z.string(),
      memo: z.string(),
      category_id: z.uuid(),
    })
    .nullable(),
}) satisfies z.ZodType<EventRecord>;
export async function listEvents(auth?: AuthContext): Promise<CalendarEvent[]> {
  const { client, userId, familyId } = await eventContext(auth);
  const { data, error } = await client
    .from("events")
    .select(selection)
    .eq("family_id", familyId)
    .order("start_date")
    .order("is_all_day", { ascending: false })
    .order("start_time", { nullsFirst: false })
    .order("end_time", { nullsFirst: false });
  throwDatabaseError(error, errors);
  return z
    .array(recordSchema)
    .parse(data)
    .map((event) => filterEventForRequester(event, userId));
}
export async function getEvent(
  id: string,
  auth?: AuthContext,
): Promise<CalendarEvent | null> {
  const { client, userId, familyId } = await eventContext(auth);
  const { data, error } = await client
    .from("events")
    .select(selection)
    .eq("family_id", familyId)
    .eq("id", idSchema.parse(id))
    .maybeSingle();
  throwDatabaseError(error, errors);
  if (!data) return null;
  const event = filterEventForRequester(recordSchema.parse(data), userId);
  // Masked slots have no detail endpoint, even if its URL is guessed.
  return event.details ? event : null;
}
export async function saveEvent(
  input: unknown,
  id: string | null = null,
  auth?: AuthContext,
) {
  const event = eventSchema.parse(input);
  const { client, userId, familyId } = await eventContext(auth);
  if (id !== null && event.visibility === "private") {
    const target = await client
      .from("events")
      .select("owner_id")
      .eq("id", idSchema.parse(id))
      .eq("family_id", familyId)
      .maybeSingle();
    throwDatabaseError(target.error, errors);
    if (!target.data)
      throw new ApiError("event_not_found", errors.event_not_found[1], 404);
    if (target.data.owner_id !== userId)
      throw new ApiError("event_forbidden", errors.event_forbidden[1], 403);
  }
  const { data, error } = await client.rpc("save_event", {
    event_id: id === null ? null : idSchema.parse(id),
    event_title: event.title,
    event_place: event.place,
    event_memo: event.memo,
    event_category_id: event.categoryId,
    event_visibility: event.visibility,
    event_start_date: event.startDate,
    event_end_date: event.endDate,
    event_start_time: event.startTime,
    event_end_time: event.endTime,
    event_is_all_day: event.isAllDay,
  });
  throwDatabaseError(error, errors);
  return data;
}
export async function deleteEvent(id: string, auth?: AuthContext) {
  const { client } = await eventContext(auth);
  const { error } = await client.rpc("delete_event", {
    event_id: idSchema.parse(id),
  });
  throwDatabaseError(error, errors);
  return null;
}
export async function listEventCategories(
  auth?: AuthContext,
): Promise<EventCategory[]> {
  const { client, familyId } = await eventContext(auth);
  const { data, error } = await client
    .from("event_categories")
    .select("id, name, color, sort_order")
    .eq("family_id", familyId)
    .order("sort_order")
    .order("name");
  throwDatabaseError(error, errors);
  return z.array(eventCategorySchema.extend({ id: z.uuid() })).parse(
    data?.map(({ sort_order, ...category }) => ({
      ...category,
      sortOrder: sort_order,
    })),
  );
}
export async function saveEventCategory(
  input: unknown,
  id: string | null = null,
  auth?: AuthContext,
) {
  const category = eventCategorySchema.parse(input);
  const { client } = await eventContext(auth);
  const { data, error } = await client.rpc("save_event_category", {
    category_id: id === null ? null : idSchema.parse(id),
    category_name: category.name,
    category_color: category.color,
    category_sort_order: category.sortOrder,
  });
  throwDatabaseError(error, errors);
  return data;
}
export async function deleteEventCategory(id: string, auth?: AuthContext) {
  const { client } = await eventContext(auth);
  const { error } = await client.rpc("delete_event_category", {
    category_id: idSchema.parse(id),
  });
  throwDatabaseError(error, errors);
  return null;
}
