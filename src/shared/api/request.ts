import { ApiError } from "./api-error";
import { z } from "zod";
const apiResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
export async function request<T>(
  url: string,
  body?: unknown,
  method?: "POST" | "PUT",
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      method: method ?? (body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "network_error",
      "연결을 확인하고 다시 시도해 주세요.",
      503,
    );
  }
  let result: ApiResult<T>;
  try {
    result = apiResultSchema.parse(await response.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(
      "invalid_response",
      "응답을 읽지 못했어요. 다시 시도해 주세요.",
      502,
    );
  }
  if (!result.ok)
    throw new ApiError(
      result.error.code,
      result.error.message,
      response.status,
    );
  if (!response.ok)
    throw new ApiError(
      "server_error",
      "처리하지 못했어요. 다시 시도해 주세요.",
      response.status,
    );
  return result.data;
}
