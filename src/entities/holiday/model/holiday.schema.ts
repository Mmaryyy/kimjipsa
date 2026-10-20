import { z } from "zod";

export const holidayYearSchema = z
  .string({ error: "연도를 입력해 주세요." })
  .regex(/^\d{4}$/, "연도는 네 자리 정수로 입력해 주세요.")
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(1900, "1900~2100년 범위로 입력해 주세요.")
      .max(2100, "1900~2100년 범위로 입력해 주세요."),
  );

const holidayItemSchema = z.object({
  locdate: z
    .union([z.number().int(), z.string()])
    .transform(String)
    .pipe(z.string().regex(/^\d{8}$/))
    .transform(
      (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    )
    .pipe(z.iso.date()),
  dateName: z.string().trim().min(1),
  isHoliday: z.enum(["Y", "N"]),
});

export const holidayResponseSchema = z.object({
  response: z.object({
    header: z.object({ resultCode: z.literal("00") }),
    body: z.object({
      totalCount: z.number().int().nonnegative(),
      items: z.union([
        z.literal(""),
        z.object({
          item: z.union([holidayItemSchema, z.array(holidayItemSchema)]),
        }),
      ]),
    }),
  }),
});
