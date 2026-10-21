import { z } from "zod";
import { eventSchema } from "@/entities/event";
export const eventFormSchema = z
  .object({
    ...eventSchema.shape,
    isTimeUnknown: z.boolean().default(false),
    startTime: z.string(),
    endTime: z.string(),
  })
  .superRefine((event, context) => {
    if (
      event.kind !== "dday" &&
      !event.isAllDay &&
      !event.isTimeUnknown &&
      !event.startTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "시작 시각을 입력해 주세요.",
      });
    }
  })
  .transform((event): z.input<typeof eventSchema> => ({
    ...event,
    endDate: event.kind === "dday" ? event.startDate : event.endDate,
    isAllDay: event.kind === "dday" || event.isAllDay,
    startTime:
      event.kind === "dday" || event.isAllDay || event.isTimeUnknown
        ? null
        : event.startTime || null,
    endTime:
      event.kind === "dday" || event.isAllDay || event.isTimeUnknown
        ? null
        : event.endTime || null,
    ddayStyle: event.kind === "dday" ? event.ddayStyle : "normal",
    celebrateMessage: event.kind === "dday" ? event.celebrateMessage : "",
  }))
  .pipe(eventSchema);
export type EventFormInput = z.input<typeof eventFormSchema>;
