import { z } from "zod";
export const notificationSettingsSchema = z.object({
  pushEnabled: z.boolean(),
  morningSummaryTime: z
    .string()
    .length(5, "시각을 확인해 주세요.")
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시각을 확인해 주세요."),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
