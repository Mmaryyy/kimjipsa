import { z } from "zod";
import { eventSchema } from "@/entities/event";
import { todoFields } from "@/entities/todo";
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
    recurrence: event.kind === "dday" ? null : event.recurrence,
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
export type EventFormInput = Omit<z.input<typeof eventFormSchema>, "kind"> & {
  kind?: z.input<typeof eventSchema>["kind"] | "todo";
  due_on?: string | null;
};

const todoFormSchema = todoFields.transform((item) => ({
  kind: "todo" as const,
  item,
}));

export const calendarFormSchema = z.transform(
  (input: EventFormInput, context) => {
    const result =
      input.kind === "todo"
        ? todoFormSchema.safeParse(input)
        : eventFormSchema.safeParse(input);
    if (result.success) return result.data;
    for (const { path, message } of result.error.issues) {
      context.addIssue({ code: "custom", path, message });
    }
    return z.NEVER;
  },
);

export type CalendarFormOutput = z.output<typeof calendarFormSchema>;
