import "server-only";
import { notifyMockEventChange } from "./mock-notifications";
import { z } from "zod";
import { tz } from "@date-fns/tz";
import { addYears, format } from "date-fns";
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
import {
  expandRecurrence,
  isRecurrenceDate,
  shiftDate,
  splitRecurrence,
} from "../lib/recurrence.utils";
import { kstDate } from "../lib/dday.utils";
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
  "id, owner_id, visibility, start_date, end_date, start_time, end_time, " +
  "is_all_day, kind, recurrence, recurrence_until, " +
  "event_details(remind_before, title, place, memo, category_id, dday_style, celebrate_message)";
const recordSchema = z.object({
  recurrence: z
    .enum(["daily", "weekly", "monthly", "yearly"])
    .nullable()
    .optional(),
  recurrence_until: z.string().nullable().optional(),
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
      remind_before: z.union([
        z.literal(10),
        z.literal(30),
        z.literal(60),
        z.literal(1440),
        z.null(),
      ]),
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
const occurrenceIdSchema = z.string().transform((value, context) => {
  const [id, date, extra] = value.split("~");
  if (
    !z.uuid().safeParse(id).success ||
    (date !== undefined && !z.iso.date().safeParse(date).success) ||
    extra !== undefined
  ) {
    context.addIssue({ code: "custom", message: "일정 주소를 확인해 주세요." });
    return z.NEVER;
  }
  return { id: id!, date };
});
const exceptionSchema = recordSchema
  .omit({
    id: true,
    owner_id: true,
    visibility: true,
    kind: true,
    recurrence: true,
    recurrence_until: true,
  })
  .extend({
    event_id: z.uuid(),
    original_date: z.iso.date(),
    cancelled: z.boolean(),
  });
type ExceptionRecord = z.infer<typeof exceptionSchema>;
async function listExceptionRecords(
  client?: SupabaseClient<Database>,
  familyId?: string,
): Promise<ExceptionRecord[]> {
  if (!client) {
    const mock = await mockEventContext();
    if (!mock) return [];
    return (await mockJson("event-exceptions")) ?? [];
  }
  const { data, error } = await client
    .from("event_exceptions")
    .select(
      `event_id, original_date, cancelled, start_date, end_date,
      start_time, end_time, is_all_day,
      event_exception_details(title, place, memo, category_id, remind_before)`,
    )
    .eq("family_id", familyId!);
  throwDatabaseError(error, errors);
  return z.array(exceptionSchema).parse(
    data?.map(({ event_exception_details, ...row }) => ({
      ...row,
      event_details: event_exception_details
        ? {
            ...event_exception_details,
            dday_style: "normal",
            celebrate_message: "",
          }
        : null,
    })),
  );
}
function expandEventRecords(
  records: EventRecord[],
  exceptions: ExceptionRecord[],
  userId: string,
  start: string,
  end: string,
  upcoming = false,
) {
  return records.flatMap((record) => {
    const event = filterEventForRequester(record, userId);
    if (!event.recurrence || event.kind === "dday") return [event];
    const overrides = exceptions
      .filter((exception) => exception.event_id === record.id)
      .map((exception) => ({
        originalDate: exception.original_date,
        replacement: exception.cancelled
          ? null
          : filterEventForRequester(
              {
                ...record,
                ...exception,
                id: record.id,
                owner_id: record.owner_id,
                visibility: record.visibility,
              },
              userId,
            ),
      }));
    let occurrences = expandRecurrence(event, start, end, overrides);
    if (upcoming) {
      const today = format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
      let horizon = end;
      while (
        occurrences.filter((entry) => entry.endDate > today).length < 10 &&
        (!event.recurrenceUntil || horizon < event.recurrenceUntil) &&
        horizon < "9998-12-31"
      ) {
        horizon = `${Math.min(9998, Number(horizon.slice(0, 4)) + 10)}-12-31`;
        const future = expandRecurrence(
          event,
          shiftDate(end, 1),
          horizon,
          overrides,
        ).slice(0, 10);
        occurrences = [
          ...new Map(
            [...expandRecurrence(event, start, end, overrides), ...future].map(
              (entry) => [entry.originalDate, entry],
            ),
          ).values(),
        ];
        if (horizon === "9998-12-31") break;
      }
    }
    return occurrences.map((occurrence) => ({
      ...occurrence,
      id: `${record.id}~${occurrence.originalDate}`,
      seriesId: record.id,
    }));
  });
}
export async function listEvents(
  auth?: AuthContext,
  range?: { start: string; end: string },
): Promise<CalendarEvent[]> {
  const today = format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
  const { start, end } = z
    .object({ start: z.iso.date(), end: z.iso.date() })
    .refine(
      ({ start, end }) =>
        start <= end &&
        Number(end.slice(0, 4)) - Number(start.slice(0, 4)) <= 12,
      "조회 기간을 확인해 주세요.",
    )
    .parse(
      range ?? {
        start: `${Number(today.slice(0, 4)) - 1}-01-01`,
        end: format(addYears(kstDate(today), 1), "yyyy-MM-dd"),
      },
    );
  const mock = await mockEventContext();
  if (mock)
    return expandEventRecords(
      await mockEvents(),
      await listExceptionRecords(),
      mock.userId,
      start,
      end,
      !range,
    );
  const { client, userId, familyId } = await eventContext(auth);
  const { data, error } = await client
    .from("events")
    .select(selection)
    .eq("family_id", familyId)
    .order("start_date");
  throwDatabaseError(error, errors);
  return expandEventRecords(
    z.array(recordSchema).parse(data),
    await listExceptionRecords(client, familyId),
    userId,
    start,
    end,
    !range,
  );
}
// BOT-10: use the same recurrence expansion and permission filter as the calendar.
export function mapAgentEvents(
  raw: unknown,
  requesterId: string,
  visibility: "shared" | "private",
  range: { start: string; end: string },
) {
  const records = z
    .object({
      records: z.array(recordSchema),
      exceptions: z.array(exceptionSchema),
    })
    .parse(raw);
  return expandEventRecords(
    records.records,
    records.exceptions,
    visibility === "private"
      ? requesterId
      : "00000000-0000-0000-0000-000000000000",
    range.start,
    range.end,
  ).filter(
    (event) =>
      event.kind === "dday" ||
      (event.startDate <= range.end && event.endDate >= range.start),
  );
}
async function nextRecurringDetail(id: string, auth?: AuthContext) {
  const today = format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Seoul") });
  const events = await listEvents(auth);
  return (
    events.find(
      (event) =>
        event.seriesId === id && event.endDate >= today && event.details,
    ) ?? null
  );
}
export async function getEvent(
  id: string,
  auth?: AuthContext,
): Promise<CalendarEvent | null> {
  const occurrence = occurrenceIdSchema.parse(id);
  if (occurrence.date) {
    const events = await listEvents(auth, {
      start: occurrence.date,
      end: occurrence.date,
    });
    const event = events.find((event) => event.id === id);
    if (event?.details) return event;
    // A moved override may now be outside its original day.
    const mock = await mockEventContext();
    const context = mock ? null : await eventContext(auth);
    const exceptions = await listExceptionRecords(
      context?.client,
      context?.familyId,
    );
    const override = exceptions.find(
      (entry) =>
        entry.event_id === occurrence.id &&
        entry.original_date === occurrence.date &&
        !entry.cancelled,
    );
    if (!override) return null;
    const moved = await listEvents(auth, {
      start: override.start_date,
      end: override.end_date,
    });
    return moved.find((event) => event.id === id && event.details) ?? null;
  }
  const mock = await mockEventContext();
  if (mock) {
    const record = (await mockEvents()).find(
      (event) => event.id === idSchema.parse(id),
    );
    if (!record) return null;
    const event = filterEventForRequester(record, mock.userId);
    if (event.recurrence && event.details)
      return nextRecurringDetail(event.id, auth);
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
  if (event.recurrence && event.details)
    return nextRecurringDetail(event.id, auth);
  // Masked slots have no detail endpoint, even if its URL is guessed.
  return event.details ? event : null;
}
export async function saveEvent(
  input: unknown,
  id: string | null = null,
  auth?: AuthContext,
) {
  const event = eventSchema.parse(input);
  const occurrence = id ? occurrenceIdSchema.parse(id) : null;
  id = occurrence?.id ?? null;
  const mock = await mockEventContext();
  if (mock) {
    const events = await mockEvents();
    const target =
      id === null ? null : requireEditableMockEvent(events, id, mock.userId);
    if (occurrence?.date && !target?.recurrence)
      throw new ApiError("invalid_event", errors.invalid_event[1], 400);
    if (
      target?.recurrence_until &&
      event.scope === "following" &&
      event.recurrence &&
      event.startDate > target.recurrence_until
    )
      throw new ApiError("invalid_event", errors.invalid_event[1], 400);
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
      recurrence: event.recurrence ?? null,
      recurrence_until: target?.recurrence_until ?? null,
      event_details: {
        remind_before: event.remindBefore,
        title: event.title,
        place: event.place,
        memo: event.memo,
        category_id: event.categoryId,
        dday_style: event.ddayStyle,
        celebrate_message: event.celebrateMessage,
      },
    };
    if (target?.recurrence) {
      const originalDate = occurrence?.date;
      const original = filterEventForRequester(target, mock.userId);
      if (
        !originalDate ||
        !event.scope ||
        !isRecurrenceDate(original, originalDate)
      )
        throw new ApiError("invalid_event", errors.invalid_event[1], 400);
      const exceptions = await listExceptionRecords();
      if (event.scope === "single") {
        if (event.kind !== "event" || event.recurrence !== target.recurrence)
          throw new ApiError("invalid_event", errors.invalid_event[1], 400);
        const override = exceptionSchema.parse({
          ...record,
          event_id: target.id,
          original_date: originalDate,
          cancelled: false,
        });
        const existing = exceptions.find(
          (entry) =>
            entry.event_id === target.id &&
            entry.original_date === originalDate,
        );
        if (existing) Object.assign(existing, override);
        else exceptions.push(override);
        target.visibility = event.visibility;
        await notifyMockEventChange(
          target,
          "event_updated",
          event.title,
          originalDate,
        );
        return target.id;
      }
      const selected = exceptions.findIndex(
        (entry) =>
          entry.event_id === target.id && entry.original_date === originalDate,
      );
      if (selected !== -1) exceptions.splice(selected, 1);
      target.visibility = event.visibility;
      const split = splitRecurrence(original, originalDate, {
        ...original,
        startDate: record.start_date,
        endDate: record.end_date,
      });
      if (split.before) {
        target.recurrence_until = split.before.recurrenceUntil;
        record.id = crypto.randomUUID();
        record.recurrence_until = record.recurrence
          ? record.recurrence_until
          : null;
        events.push(record);
        for (const exception of exceptions) {
          if (
            exception.event_id === target.id &&
            exception.original_date > originalDate
          )
            exception.event_id = record.id;
        }
        await notifyMockEventChange(
          record,
          "event_updated",
          event.title,
          record.start_date,
        );
        return record.id;
      }
      record.recurrence_until = record.recurrence
        ? record.recurrence_until
        : null;
    }
    await notifyMockEventChange(
      record,
      target ? "event_updated" : "event_created",
      event.title,
      record.recurrence || target?.recurrence ? record.start_date : undefined,
    );
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
    event_recurrence: event.recurrence ?? null,
    occurrence_date: occurrence?.date ?? null,
    edit_scope: event.scope ?? null,
    event_remind_before: event.remindBefore,
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
  if (data === null)
    throw new ApiError(
      "database_error",
      "저장하지 못했어요. 다시 시도해 주세요.",
      500,
    );
  return data;
}
export async function deleteEvent(
  id: string,
  auth?: AuthContext,
  input?: unknown,
) {
  const scope = z
    .object({ scope: z.enum(["single", "following"]).optional() })
    .parse(input ?? {}).scope;
  const occurrence = occurrenceIdSchema.parse(id);
  id = occurrence.id;
  const mock = await mockEventContext();
  if (mock) {
    const events = await mockEvents();
    const target = requireEditableMockEvent(events, id, mock.userId);
    if (occurrence.date && !target.recurrence)
      throw new ApiError("invalid_event", errors.invalid_event[1], 400);
    if (target.recurrence) {
      if (
        !occurrence.date ||
        !scope ||
        !isRecurrenceDate(
          filterEventForRequester(target, mock.userId),
          occurrence.date,
        )
      )
        throw new ApiError("invalid_event", errors.invalid_event[1], 400);
      const exceptions = await listExceptionRecords();
      if (scope === "single") {
        const existing = exceptions.find(
          (entry) =>
            entry.event_id === id && entry.original_date === occurrence.date,
        );
        if (existing) existing.cancelled = true;
        else
          exceptions.push({
            ...target,
            event_details: null,
            event_id: target.id,
            original_date: occurrence.date,
            cancelled: true,
          });
        await notifyMockEventChange(
          target,
          "event_deleted",
          target.event_details?.title ?? "공유 일정",
          occurrence.date,
        );
        return null;
      }
      if (occurrence.date !== target.start_date) {
        target.recurrence_until = shiftDate(occurrence.date, -1);
        for (let index = exceptions.length - 1; index >= 0; index--) {
          if (
            exceptions[index].event_id === id &&
            exceptions[index].original_date >= occurrence.date
          )
            exceptions.splice(index, 1);
        }
        await notifyMockEventChange(
          target,
          "event_deleted",
          target.event_details?.title ?? "공유 일정",
          occurrence.date,
        );
        return null;
      }
    }
    await notifyMockEventChange(
      target,
      "event_deleted",
      target.event_details?.title ?? "공유 일정",
    );
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
    occurrence_date: occurrence.date ?? null,
    edit_scope: scope ?? null,
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
    for (const exception of await listExceptionRecords()) {
      if (exception.event_details?.category_id === id)
        exception.event_details.category_id = fallback.id;
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
