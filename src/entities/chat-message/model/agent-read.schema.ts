import { z } from "zod";

export const agentReadSchema = z
  .object({
    resource: z.enum(["memories", "inventory", "cart", "calendar"]),
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
  })
  .strict()
  .refine(({ start, end, resource }) => {
    if (!start && !end) return true;
    return (
      resource === "calendar" &&
      !!start &&
      !!end &&
      start <= end &&
      (Date.parse(end) - Date.parse(start)) / 86400000 <= 366
    );
  });
export type AgentReadInput = z.infer<typeof agentReadSchema>;
