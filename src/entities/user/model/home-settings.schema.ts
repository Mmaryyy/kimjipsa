import { z } from "zod";
export const homeSettingsSchema = z.object({
  homeView: z.enum(["month", "week", "day"]),
  upcomingEnabled: z.boolean(),
  upcomingCount: z.union([z.literal(3), z.literal(5), z.literal(10)]),
});
export type HomeSettings = z.infer<typeof homeSettingsSchema>;
