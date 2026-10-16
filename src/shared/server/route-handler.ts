import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/shared/api";
export function throwDatabaseError(
  error: { message: string } | null,
  messages: Readonly<Record<string, readonly [number, string]>> = {},
) {
  if (!error) return;
  const code = error.message;
  if (Object.hasOwn(messages, code)) {
    const [status, message] = messages[code];
    throw new ApiError(code, message, status);
  }
  throw new ApiError(
    "database_error",
    "저장하거나 불러오지 못했어요. 다시 시도해 주세요.",
    500,
  );
}
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("invalid_json", "입력 내용을 확인해 주세요.");
  }
}
export async function handleRoute<T>(
  request: Request,
  action: () => Promise<T>,
) {
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
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
    return NextResponse.json(
      { ok: false, error: { code: failure.code, message: failure.message } },
      {
        status: failure.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
