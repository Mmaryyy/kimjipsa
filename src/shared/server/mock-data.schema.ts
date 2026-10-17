import "server-only";
import { tz } from "@date-fns/tz";
import { addDays, format, subYears } from "date-fns";
import { z } from "zod";
import { categoryColors } from "@/shared/ui";

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
  family: familySchema,
  events: eventsSchema,
  "event-categories": eventCategoriesSchema,
  "home-settings": homeSettingsSchema,
  invites: invitesSchema,
};

export type MockData = {
  [Name in keyof typeof mockDataSchemas]: z.output<
    (typeof mockDataSchemas)[Name]
  >;
};
