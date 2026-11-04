// @vitest-environment node
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readToolRequest } from "./read-tool.mts";
import { requiresIsolatedRuntime, type AgentContext } from "./hermes.mts";

const reader = vi.fn(async () => ({ items: [{ name: "우유", quantity: 2 }] }));
const server = createServer((request, response) => {
  void readToolRequest(request, response, "fixture-token", reader);
});
let url: string;
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing_address");
  url = `http://127.0.0.1:${address.port}/hermes/read`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
function read(
  body: unknown,
  authorization = "Bearer fixture-token",
  origin?: string,
) {
  return fetch(url, {
    method: "POST",
    headers: {
      authorization,
      "Content-Type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}
describe("BOT-06/10 Supabase 조회 도구 경계", () => {
  it("인증된 요청에 공용 조회 결과를 반환해요", async () => {
    const response = await read({ resource: "inventory" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { items: [{ name: "우유", quantity: 2 }] },
    });
  });
  it("토큰 없는 호출과 브라우저 Origin을 거부해요", async () => {
    const count = reader.mock.calls.length;
    expect((await read({ resource: "memories" }, "")).status).toBe(403);
    expect(
      (
        await read(
          { resource: "memories" },
          "Bearer fixture-token",
          "https://example.com",
        )
      ).status,
    ).toBe(403);
    expect(reader.mock.calls.length).toBe(count);
  });
  it("임의 SQL·가정 지정·개인 조회와 너무 긴 기간을 거부해요", async () => {
    for (const body of [
      { resource: "sql", query: "select 1" },
      { resource: "memories", familyId: "another-family" },
      { resource: "calendar", visibility: "private" },
      { resource: "calendar", start: "2026-01-01", end: "2028-01-01" },
    ])
      expect((await read(body)).status).toBe(400);
  });
  it("조회 서버 오류를 원문·시크릿 없이 반환해요", async () => {
    reader.mockRejectedValueOnce(new Error("secret database endpoint"));
    const response = await read({ resource: "cart" });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  });
});
describe("BOT-10/12 자체 기억의 입력 범위", () => {
  const shared = { visibility: "shared" } as AgentContext;
  it("공용 텍스트는 지속 프로필에서, 개인 대화·사진·검색은 격리해요", () => {
    expect(requiresIsolatedRuntime(shared, false, false)).toBe(false);
    expect(
      requiresIsolatedRuntime(
        { ...shared, visibility: "private" },
        false,
        false,
      ),
    ).toBe(true);
    expect(requiresIsolatedRuntime(shared, true, false)).toBe(true);
    expect(requiresIsolatedRuntime(shared, false, true)).toBe(true);
  });
});
