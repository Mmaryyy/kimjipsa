import "server-only";
import { z } from "zod";
import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api";
import { ApiError } from "@/shared/api";
import {
  mockContext,
  mockJson,
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
  "id, owner_id, visibility, start_date, end_date, start_time, end_time, is_all_day, kind, event_details(title, place, memo, category_id, dday_style, celebrate_message)";
const recordSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid().nullable(),
  visibility: z.enum(["shared", "private"]),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  is_all_day: z.boolean(),
  kind: z.enum(["event", "dday"]),
  event_details: z
    .object({
      dday_style: z.enum(["normal", "celebrate"]),
      celebrate_message: z.string(),
      title: z.string(),
      place: z.string(),
      memo: z.string(),
      category_id: z.uuid(),
    })
    .nullable(),
}) satisfies z.ZodType<EventRecord>;
async function mockEvents() {
  return mockJson("events");
}
async function mockCategories() {
  return mockJson("event-categories");
}
async function mockEventContext() {
  const context = await mockContext();
  if (!context) return null;
  const stage = context.values.get("account-stage") ?? context.stage;
  if (stage === "login")
    throw new ApiError("unauthorized", errors.unauthorized[1], 401);
  if (stage === "profile" || stage === "family")
    throw new ApiError("family_required", errors.family_required[1], 403);
  // The family fixture supplies identity; no Supabase auth or service key is used.
  const family = await mockJson("family");
  return { ...context, userId: family.members[context.perspective]!.user_id };
}
function requireEditableMockEvent(
  events: EventRecord[],
  id: string,
  userId: string,
) {
  const event = events.find((candidate) => candidate.id === idSchema.parse(id));
  if (!event)
    throw new ApiError("event_not_found", errors.event_not_found[1], 404);
  if (event.visibility === "private" && event.owner_id !== userId)
    throw new ApiError("event_forbidden", errors.event_forbidden[1], 403);
  return event;
}
export async function listEvents(auth?: AuthContext): Promise<CalendarEvent[]> {
  const mock = await mockEventContext();
  if (mock)
    return (await mockEvents()).map((event) =>
      filterEventForRequester(event, mock.userId),
    );
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
  const mock = await mockEventContext();
  if (mock) {
    const record = (await mockEvents()).find(
      (event) => event.id === idSchema.parse(id),
    );
    if (!record) return null;
    const event = filterEventForRequester(record, mock.userId);
    return event.details ? event : null;
  }
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
  const mock = await mockEventContext();
  if (mock) {
    const events = await mockEvents();
    const target =
      id === null ? null : requireEditableMockEvent(events, id, mock.userId);
    if (
      target &&
      event.visibility === "private" &&
      target.owner_id !== mock.userId
    )
      throw new ApiError("event_forbidden", errors.event_forbidden[1], 403);
    if (
      !(await mockCategories()).some(
        (category) => category.id === event.categoryId,
      )
    )
      throw new ApiError(
        "category_not_found",
        errors.category_not_found[1],
        404,
      );
    const record = {
      id: target?.id ?? crypto.randomUUID(),
      owner_id: target ? target.owner_id : mock.userId,
      visibility: event.visibility,
      start_date: event.startDate,
      end_date: event.endDate,
      start_time: event.startTime,
      end_time: event.endTime,
      is_all_day: event.isAllDay,
      kind: event.kind,
      event_details: {
        title: event.title,
        place: event.place,
        memo: event.memo,
        category_id: event.categoryId,
        dday_style: event.ddayStyle,
        celebrate_message: event.celebrateMessage,
      },
    };
    if (target) Object.assign(target, record);
    else events.push(record);
    return record.id;
  }
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
    event_kind: event.kind,
    event_dday_style: event.ddayStyle,
    event_celebrate_message: event.celebrateMessage,
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
  const mock = await mockEventContext();
  if (mock) {
    const events = await mockEvents();
    const target = requireEditableMockEvent(events, id, mock.userId);
    events.splice(events.indexOf(target as (typeof events)[number]), 1);
    for (const [key, value] of mock.values) {
      if (key.startsWith("dday-dismissals:") && Array.isArray(value))
        mock.values.set(
          key,
          value.filter((entry: { event_id: string }) => entry.event_id !== id),
        );
    }
    return null;
  }
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
  if (await mockEventContext())
    return [...(await mockCategories())].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"),
    );
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
  if (await mockEventContext()) {
    const categories = await mockCategories();
    const target =
      id === null
        ? null
        : categories.find((entry) => entry.id === idSchema.parse(id));
    if (id !== null && !target)
      throw new ApiError(
        "category_not_found",
        errors.category_not_found[1],
        404,
      );
    if (target?.name === "기타" && category.name !== "기타")
      throw new ApiError("fallback_category", errors.fallback_category[1], 409);
    if (
      categories.some(
        (entry) => entry.id !== id && entry.name === category.name,
      )
    )
      throw new ApiError(
        "category_duplicate",
        errors.category_duplicate[1],
        409,
      );
    const targetOrder = Math.min(
      category.sortOrder,
      categories.length - (target ? 1 : 0),
    );
    for (const entry of categories) {
      if (!target && entry.sortOrder >= targetOrder) entry.sortOrder += 1;
      if (
        target &&
        targetOrder < target.sortOrder &&
        entry.sortOrder >= targetOrder &&
        entry.sortOrder < target.sortOrder
      )
        entry.sortOrder += 1;
      if (
        target &&
        targetOrder > target.sortOrder &&
        entry.sortOrder > target.sortOrder &&
        entry.sortOrder <= targetOrder
      )
        entry.sortOrder -= 1;
    }
    const record = {
      ...category,
      sortOrder: targetOrder,
      id: id ?? crypto.randomUUID(),
    };
    if (target) Object.assign(target, record);
    else categories.push(record);
    return record.id;
  }
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
  if (await mockEventContext()) {
    const categories = await mockCategories();
    const target = categories.find((entry) => entry.id === idSchema.parse(id));
    if (!target)
      throw new ApiError(
        "category_not_found",
        errors.category_not_found[1],
        404,
      );
    if (target.name === "기타")
      throw new ApiError("fallback_category", errors.fallback_category[1], 409);
    const fallback = categories.find((entry) => entry.name === "기타");
    if (!fallback)
      throw new ApiError(
        "category_not_found",
        errors.category_not_found[1],
        404,
      );
    for (const event of await mockEvents()) {
      if (event.event_details?.category_id === id)
        event.event_details.category_id = fallback.id;
    }
    categories.splice(categories.indexOf(target), 1);
    return null;
  }
  const { client } = await eventContext(auth);
  const { error } = await client.rpc("delete_event_category", {
    category_id: idSchema.parse(id),
  });
  throwDatabaseError(error, errors);
  return null;
}

export async function listDdayDismissals(auth?: AuthContext) {
  const mock = await mockEventContext();
  if (mock)
    return z
      .array(z.object({ event_id: z.uuid(), year: z.number().int() }))
      .parse(mock.values.get(`dday-dismissals:${mock.userId}`) ?? []);
  const { client, userId } = await eventContext(auth);
  const { data, error } = await client
    .from("dday_card_dismissals")
    .select("event_id, year")
    .eq("user_id", userId);
  throwDatabaseError(error, errors);
  return z
    .array(z.object({ event_id: z.uuid(), year: z.number().int() }))
    .parse(data);
}
export async function dismissDdayCard(id: string, auth?: AuthContext) {
  const mock = await mockEventContext();
  if (mock) {
    const event = await getEvent(id);
    const today = format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
    if (
      !event?.details ||
      event.kind !== "dday" ||
      event.details.ddayStyle !== "celebrate" ||
      event.startDate > today ||
      event.startDate.slice(5) !== today.slice(5)
    )
      throw new ApiError("event_not_found", errors.event_not_found[1], 404);
    const dismissals = await listDdayDismissals();
    const year = Number(today.slice(0, 4));
    if (
      !dismissals.some((entry) => entry.event_id === id && entry.year === year)
    )
      dismissals.push({ event_id: id, year });
    mock.values.set(`dday-dismissals:${mock.userId}`, dismissals);
    return null;
  }
  const { client } = await eventContext(auth);
  const { error } = await client.rpc("dismiss_dday_card", {
    event_id: idSchema.parse(id),
  });
  throwDatabaseError(error, errors);
  return null;
}
