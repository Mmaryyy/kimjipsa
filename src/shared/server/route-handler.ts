import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/shared/api";
const databaseCodes = new WeakMap<Error, string>();

export function throwDatabaseError(
  error: { message: string; code?: string } | null,
  messages: Readonly<Record<string, readonly [number, string]>> = {},
) {
  if (!error) return;
  const code = error.message;
  if (Object.hasOwn(messages, code)) {
    const [status, message] = messages[code];
    throw new ApiError(code, message, status);
  }
  const failure = new ApiError(
    "database_error",
    "저장하거나 불러오지 못했어요. 다시 시도해 주세요.",
    500,
  );
  if (error.code && /^[0-9A-Z]{5}$/.test(error.code))
    databaseCodes.set(failure, error.code);
  throw failure;
}
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("invalid_json", "입력 내용을 확인해 주세요.");
  }
}
const routeSegments = new Set([
  "api",
  "account",
  "home-settings",
  "notification-settings",
  "profile",
  "withdraw",
  "cart",
  "cron",
  "notifications",
  "dday-dismissals",
  "event-categories",
  "delete",
  "events",
  "dismiss",
  "family",
  "member-role",
  "holidays",
  "inventory-meta",
  "inventory",
  "invites",
  "push",
  "subscriptions",
]);

export async function handleRoute<T>(
  request: Request,
  action: () => Promise<T>,
) {
  const requestId = randomUUID();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Request-Id": requestId,
  };
  try {
    // Cookies authenticate writes; check Origin to prevent cross-site submissions.
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== new URL(request.url).origin
    ) {
      throw new ApiError(
        "invalid_origin",
        "이 화면에서 다시 시도해 주세요.",
        403,
      );
    }
    const data = await action();
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) {
    let failure = new ApiError(
      "server_error",
      "처리하지 못했어요. 다시 시도해 주세요.",
      500,
    );
    if (error instanceof ApiError) failure = error;
    if (error instanceof ZodError)
      failure = new ApiError(
        "validation_failed",
        error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
      );
    if (failure.status >= 500) {
      // Never log raw errors, request bodies, headers or dynamic route values.
      const route = new URL(request.url).pathname
        .split("/")
        .map((segment) =>
          !segment || routeSegments.has(segment) ? segment : "[id]",
        )
        .join("/");
      const code = ["database_error", "auth_unavailable"].includes(failure.code)
        ? failure.code
        : "server_error";
      console.error(
        JSON.stringify({
          route,
          method: request.method,
          code,
          message: "서버 요청 처리 실패",
          requestId,
          databaseCode:
            error instanceof Error ? databaseCodes.get(error) : undefined,
          errorName:
            error instanceof Error &&
            [
              "Error",
              "TypeError",
              "RangeError",
              "ReferenceError",
              "SyntaxError",
              "ApiError",
            ].includes(error.name)
              ? error.name
              : "UnknownError",
        }),
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: failure.code, message: failure.message } },
      {
        status: failure.status,
        headers,
      },
    );
  }
}
