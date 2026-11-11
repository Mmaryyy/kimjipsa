import { describe, expect, it } from "vitest";
import { sanitizeErrorEvent, sanitizeErrorRoute } from ".";

describe("DEC-013 오류 모니터링 개인정보 제외", () => {
  it("오류 원문·요청·사용자·첨부·코드 문맥을 버리고 코드 위치만 남겨요", () => {
    const secret = "private@example.test secret-token 개인 일정";
    const result = sanitizeErrorEvent({
      type: undefined,
      event_id: "event",
      message: secret,
      environment: secret,
      transaction: secret,
      user: { email: secret },
      request: { url: secret, headers: { cookie: secret }, data: secret },
      breadcrumbs: [{ message: secret }],
      extra: { attachment: secret },
      contexts: { private: { value: secret } },
      tags: { title: secret },
      sdk: {
        name: "sentry.javascript.nextjs",
        version: "11.11.0",
        settings: { infer_ip: "auto" },
      },
      exception: {
        values: [
          {
            type: secret,
            value: secret,
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://example.test/_next/static/chunks/app.js?token=secret-token",
                  function: secret,
                  context_line: secret,
                  vars: { secret },
                  lineno: 12,
                  colno: 3,
                },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private@|secret-token|개인 일정/,
    );
    expect(result.tags?.environment).toBeUndefined();
    expect(result.sdk?.settings).toEqual({ infer_ip: "never" });
    expect(result.exception?.values?.[0]).toMatchObject({
      type: "Error",
      value: "Application error",
      stacktrace: {
        frames: [
          { filename: "/_next/static/chunks/app.js", lineno: 12, colno: 3 },
        ],
      },
    });
  });
});

it.each(["production", "preview"])(
  "DEC-013 %s 환경과 가린 API 경로만 태그로 남겨요",
  (environment) => {
    const result = sanitizeErrorEvent({
      type: undefined,
      environment,
      tags: {
        route: "/api/events/private-event-id?title=private-title#private-note",
        private: "private-value",
      },
      request: { url: "https://example.test/private-url" },
    });
    expect(result.tags).toEqual({
      route: "/api/events/[id]",
      environment,
    });
    expect(result.request).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("private");
  },
);

it("DEC-013 클라이언트 요청 URL에서 화면 경로만 남겨요", () => {
  const result = sanitizeErrorEvent({
    type: undefined,
    request: {
      url: "https://example.test/calendar?event=private-id#private-note",
    },
  });
  expect(result.tags?.route).toBe("/calendar");
  expect(result.request).toBeUndefined();
});

it.each([
  ["https://example.test/api/invites/private-token", "/api/invites/[id]"],
  ["/settings/frequent-items", "/settings/frequent-items"],
  ["/api/chat/runs/private-id/retry", "/api/chat/runs/[id]/retry"],
  ["/", "/"],
  [undefined, undefined],
  ["http://[", undefined],
])("DEC-013 경로 %s의 동적 값은 남기지 않아요", (url, expected) => {
  expect(sanitizeErrorRoute(url)).toBe(expected);
});
