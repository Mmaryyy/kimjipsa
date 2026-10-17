import { z } from "zod";
import { eventSchema } from "@/entities/event";
export const eventFormSchema = z
  .object({
    ...eventSchema.shape,
    startTime: z.string(),
    endTime: z.string(),
  })
  .transform((event): z.input<typeof eventSchema> => ({
    ...event,
    endDate: event.kind === "dday" ? event.startDate : event.endDate,
    isAllDay: event.kind === "dday" || event.isAllDay,
    startTime:
      event.kind === "dday" || event.isAllDay ? null : event.startTime || null,
    endTime:
      event.kind === "dday" || event.isAllDay ? null : event.endTime || null,
    ddayStyle: event.kind === "dday" ? event.ddayStyle : "normal",
    celebrateMessage: event.kind === "dday" ? event.celebrateMessage : "",
  }))
  .pipe(eventSchema);
export type EventFormInput = z.input<typeof eventFormSchema>;
