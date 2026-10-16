import { z } from "zod";
import { eventSchema } from "@/entities/event";
export const eventFormSchema = z
  .object({
    ...eventSchema.shape,
    startTime: z.string(),
    endTime: z.string(),
  })
  .transform((event) => ({
    ...event,
    startTime: event.startTime || null,
    endTime: event.endTime || null,
  }))
  .pipe(eventSchema);
export type EventFormInput = z.input<typeof eventFormSchema>;
