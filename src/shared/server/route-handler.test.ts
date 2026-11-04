// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import { handleRoute, throwDatabaseError } from "./route-handler";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
describe("P10 서버 오류 로그", () => {
  it("예상하지 못한 오류만 안전한 한 줄로 남겨요", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleRoute(
      new Request(
        "https://example.test/api/invites/secret-token?email=private@example.test",
        {
          method: "POST",
          headers: {
            origin: "https://example.test",
            authorization: "Bearer secret-token",
          },
          body: "일정 제목과 메모",
        },
      ),
      async () => {
        throw new Error(
          "private@example.test 표시 이름 일정 제목과 메모 secret-token",
        );
      },
    );
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]![0] as string;
    expect(JSON.parse(line)).toEqual({
      route: "/api/invites/[id]",
      method: "POST",
      code: "server_error",
      message: "서버 요청 처리 실패",
      requestId: response.headers.get("X-Request-Id"),
      errorName: "Error",
    });
    expect(line).not.toMatch(
      /private@|표시 이름|일정 제목|메모|secret-token|Bearer/,
    );
    expect(line).not.toContain("\n");
  });
  it("DB 실패의 원본 메시지도 기록하지 않아요", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await handleRoute(
      new Request("https://example.test/api/events"),
      async () => {
        throw new ApiError("database_error", "private@example.test", 500);
      },
    );
    expect(JSON.parse(log.mock.calls[0]![0] as string).code).toBe(
      "database_error",
    );
    expect(log.mock.calls.flat().join()).not.toContain("private@");
  });
  it("PG 오류 코드는 메시지 없이 요청 id와 함께 남겨요", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleRoute(
      new Request("https://example.test/api/events"),
      async () => {
        throwDatabaseError({ code: "42703", message: "private column" });
      },
    );
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({
      databaseCode: "42703",
      requestId: response.headers.get("X-Request-Id"),
    });
    expect(log.mock.calls.flat().join()).not.toContain("private column");
  });
  it("입력 검증과 권한 오류는 기록하지 않아요", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [
      new ApiError("forbidden", "접근 불가", 403),
      z.string().safeParse(1).error,
    ]) {
      await handleRoute(
        new Request("https://example.test/api/events"),
        async () => {
          throw error;
        },
      );
    }
    expect(log).not.toHaveBeenCalled();
  });
});

it("BOT-07 검증 응답에는 첫 이슈의 필드만 더하고 입력값은 보내지 않아요", async () => {
  const response = await handleRoute(
    new Request("https://example.test/api/agent/complete"),
    async () => {
      z.object({
        actions: z.array(
          z.object({
            payload: z.object({
              event: z.object({
                categoryId: z.uuid("카테고리를 선택해 주세요."),
              }),
            }),
          }),
        ),
      }).parse({
        actions: [{ payload: { event: { categoryId: "PRIVATE_VALUE" } } }],
      });
    },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    ok: false,
    error: {
      code: "validation_failed",
      message: "카테고리를 선택해 주세요.",
      field: "actions.0.payload.event.categoryId",
    },
  });
});
