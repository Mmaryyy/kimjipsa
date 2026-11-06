import "server-only";
import { z } from "zod";
import { format, addMonths } from "date-fns";
import { tz } from "@date-fns/tz";
import {
  agentRequest,
  agentResultSchema,
  agentReadRequest,
  agentReadSchema,
} from "@/entities/chat-message/index.server";
import { mapAgentEvents } from "@/entities/event/index.server";
import { handleRoute, readJson } from "@/shared/server";
import { ApiError, type Json } from "@/shared/api";
import { parseAgentActions } from "./agent-actions.schema";

const leaseSchema = z.object({ jobId: z.uuid(), leaseToken: z.uuid() });
const rangeSchema = z
  .object({ start: z.iso.date(), end: z.iso.date() })
  .refine(
    ({ start, end }) =>
      start <= end && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366,
  );
export function agentReadPOST(request: Request) {
  return handleRoute(request, async () => {
    const input = agentReadSchema.parse(await readJson(request));
    const result = await agentReadRequest(request, input);
    if (input.resource !== "calendar") return result;
    const today = new Date();
    const range = rangeSchema.parse({
      start:
        input.start ?? format(today, "yyyy-MM-dd", { in: tz("Asia/Seoul") }),
      end:
        input.end ??
        format(addMonths(today, 6, { in: tz("Asia/Seoul") }), "yyyy-MM-dd", {
          in: tz("Asia/Seoul"),
        }),
    });
    const calendar = z
      .object({
        records: z.array(z.unknown()),
        exceptions: z.array(z.unknown()),
        categories: z.array(z.unknown()),
      })
      .parse(result);
    return {
      range,
      categories: calendar.categories,
      events: mapAgentEvents(
        calendar,
        "00000000-0000-0000-0000-000000000000",
        "shared",
        range,
      ),
    };
  });
}
export function agentContextPOST(request: Request) {
  return handleRoute(request, async () => {
    const params = z
      .object({
        jobId: z.uuid(),
        leaseToken: z.uuid(),
        range: rangeSchema.optional(),
      })
      .parse(await readJson(request));
    const lease = leaseSchema.parse(params);
    const today = new Date();
    const range = rangeSchema.parse({
      start:
        params.range?.start ??
        format(addMonths(today, -1, { in: tz("Asia/Seoul") }), "yyyy-MM-dd", {
          in: tz("Asia/Seoul"),
        }),
      end:
        params.range?.end ??
        format(addMonths(today, 6, { in: tz("Asia/Seoul") }), "yyyy-MM-dd", {
          in: tz("Asia/Seoul"),
        }),
    });
    const raw = z
      .object({
        actorId: z.uuid().nullable(),
        visibility: z.enum(["shared", "private"]),
        calendar: z.object({
          records: z.array(z.unknown()),
          exceptions: z.array(z.unknown()),
          revisions: z.record(z.string(), z.string()),
          categories: z.array(z.unknown()),
        }),
      })
      .passthrough()
      .parse(await agentRequest(request, "context", lease));
    const { calendar, ...context } = raw;
    return {
      ...context,
      calendarRange: range,
      eventCategories: calendar.categories,
      events: mapAgentEvents(
        calendar,
        raw.actorId ?? "00000000-0000-0000-0000-000000000000",
        raw.visibility,
        range,
      ).map((event) => ({
        ...event,
        revision: calendar.revisions[event.seriesId ?? event.id],
      })),
    };
  });
}
export function agentCompletePOST(request: Request) {
  return handleRoute(request, async () => {
    const raw = await readJson(request);
    const lease = leaseSchema.parse(raw);
    const result = agentResultSchema.parse(raw);
    if (["actions", "add", "proposal"].includes(result.kind))
      throw new ApiError(
        "confirmation_required",
        "모든 변경은 확인 후 실행할 수 있어요.",
        400,
      );
    if (result.kind === "action_proposal")
      result.actions = parseAgentActions(result.actions);
    return agentRequest(request, "complete", { ...lease, ...result } as Json);
  });
}
