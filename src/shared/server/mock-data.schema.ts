import "server-only";

import { tz } from "@date-fns/tz";
import { addDays, format, subYears } from "date-fns";
import { z } from "zod";
import { categoryColors } from "@/shared/ui";

// Raw mock JSON contracts stay in shared; entity input rules live in their own models.
const inventoryItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mode: z.enum(["quantity", "status"]),
  quantity: z.number(),
  status: z.enum(["enough", "low", "none"]),
  unit_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  location_id: z.uuid().nullable(),
  min_quantity: z.number().nullable(),
  expires_on: z.iso.date().nullable(),
  mock_expires_in_days: z.number().int().nullable(),
});
const inventoryMetaEntrySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  icon_kind: z.enum(["lucide", "text"]).nullable().default(null),
  icon_value: z.string().default(""),
});
const inventoryMetaSchema = z.object({
  categories: z.array(inventoryMetaEntrySchema),
  locations: z.array(inventoryMetaEntrySchema),
  units: z.array(inventoryMetaEntrySchema),
  expiry_days: z.number().int().nonnegative(),
});

const familySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  members: z
    .array(
      z.object({
        user_id: z.uuid(),
        display_name: z.string(),
        role: z.enum(["admin", "member", "child"]),
      }),
    )
    .min(
      2,
      "mocks/family.json에는 시점 전환을 위한 구성원이 최소 2명 필요해요.",
    ),
});

const eventSchema = z.object({
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
      remind_before: z
        .union([
          z.literal(10),
          z.literal(30),
          z.literal(60),
          z.literal(1440),
          z.null(),
        ])
        .default(30),
      dday_style: z.enum(["normal", "celebrate"]),
      celebrate_message: z.string(),
      title: z.string(),
      place: z.string(),
      memo: z.string(),
      category_id: z.uuid(),
    })
    .nullable(),
  mock_start_offset: z.number().int().optional(),
  mock_end_offset: z.number().int().optional(),
  mock_years_ago: z.number().int().optional(),
});

const eventsSchema = z.array(eventSchema).transform((records) => {
  const today = new Date();
  const options = { in: tz("Asia/Seoul") };
  return records.map((record) => {
    const { mock_start_offset, mock_end_offset, mock_years_ago, ...event } =
      record;
    if (mock_start_offset !== undefined) {
      const start = subYears(
        addDays(today, mock_start_offset, options),
        mock_years_ago ?? 0,
        options,
      );
      const end = subYears(
        addDays(today, mock_end_offset ?? mock_start_offset, options),
        mock_years_ago ?? 0,
        options,
      );
      event.start_date = format(start, "yyyy-MM-dd", options);
      event.end_date = format(end, "yyyy-MM-dd", options);
    }
    return event;
  });
});

const eventCategoriesSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string().trim().min(1),
    color: z.enum(
      Object.keys(categoryColors) as [
        keyof typeof categoryColors,
        ...(keyof typeof categoryColors)[],
      ],
    ),
    sortOrder: z.number().int().min(0),
  }),
);

const homeSettingsSchema = z.object({
  homeView: z.enum(["month", "week", "day"]),
  upcomingEnabled: z.boolean(),
  upcomingCount: z.union([z.literal(3), z.literal(5), z.literal(10)]),
});

const invitesSchema = z
  .array(
    z.object({
      token: z.uuid(),
      used: z.boolean(),
      createdBy: z.uuid().nullable().optional(),
      acceptedBy: z.uuid().nullable().optional(),
      mock_expires_in_days: z.number(),
    }),
  )
  .transform((invitations) =>
    invitations.map(({ mock_expires_in_days, ...invitation }) => ({
      ...invitation,
      expiresAt: new Date(
        Date.now() + mock_expires_in_days * 86400000,
      ).toISOString(),
    })),
  );

// 파일마다 검증과 초기 변환을 한 곳에서 정해 호출 순서에 영향받지 않아요.
export const mockDataSchemas = {
  "inventory-items": z.array(inventoryItemSchema).transform((items) =>
    items.map(({ mock_expires_in_days, ...item }) => ({
      ...item,
      expires_on:
        mock_expires_in_days === null
          ? null
          : format(
              addDays(new Date(), mock_expires_in_days, {
                in: tz("Asia/Seoul"),
              }),
              "yyyy-MM-dd",
              { in: tz("Asia/Seoul") },
            ),
    })),
  ),
  "cart-items": z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        quantity: z.number(),
        unit_id: z.uuid().nullable(),
        category_id: z.uuid().nullable(),
        memo: z.string(),
        link_url: z.string(),
        added_by: z.uuid().nullable(),
        checked_by: z.uuid().nullable(),
        is_checked: z.boolean(),
        inventory_item_id: z.uuid().nullable(),
        purchased_at: z.string().nullable(),
      }),
    )
    .transform((items) =>
      items.map((item, index) => ({
        ...item,
        created_at: new Date(
          Date.now() - (items.length - index) * 60000,
        ).toISOString(),
        purchased_at: item.purchased_at
          ? new Date(Date.now() - (index + 1) * 86400000).toISOString()
          : null,
      })),
    ),
  "inventory-meta": inventoryMetaSchema,
  "inventory-defaults": inventoryMetaSchema,
  "special-days": z.array(
    z.object({
      date: z.iso.date(),
      name: z.string().min(1),
      kind: z.enum(["solarTerm", "sundry"]),
    }),
  ),
  holidays: z.array(z.object({ date: z.iso.date(), name: z.string().min(1) })),
  notifications: z
    .array(
      z.object({
        id: z.uuid(),
        user_id: z.uuid(),
        family_id: z.uuid(),
        kind: z.enum(["event_created", "event_updated", "event_deleted"]),
        payload: z.object({
          eventId: z.uuid(),
          occurrenceDate: z.iso.date().optional(),
          actorName: z.string(),
          eventTitle: z.string().optional(),
          eventDeleted: z.boolean().optional(),
        }),
        read_at: z.string().nullable(),
        created_at: z.string(),
      }),
    )
    .transform((records) =>
      records.map((record, index) => ({
        ...record,
        created_at: new Date(
          Date.now() - index * 86400000 - (60 + index * 47) * 60000,
        ).toISOString(),
      })),
    ),
  family: familySchema,
  events: eventsSchema,
  "event-exceptions": z.array(
    eventSchema
      .omit({ id: true, owner_id: true, visibility: true, kind: true })
      .extend({
        event_id: z.uuid(),
        original_date: z.iso.date(),
        cancelled: z.boolean(),
      }),
  ),
  "event-categories": eventCategoriesSchema,
  "notification-settings": z.object({
    pushEnabled: z.boolean(),
    morningSummaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  "home-settings": homeSettingsSchema,
  invites: invitesSchema,
};

export type MockData = {
  [Name in keyof typeof mockDataSchemas]: z.output<
    (typeof mockDataSchemas)[Name]
  >;
};
