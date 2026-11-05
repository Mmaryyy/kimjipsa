// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { configSchema } from "./config.mts";
import { HermesRuntime } from "./hermes.mts";

function setup(output: string) {
  const runtime = new HermesRuntime(
    configSchema.parse({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.com",
      supabaseAnonKey: "fixture",
      workerEmail: "worker@example.com",
      hermesCommand: "hermes",
      hermesPython: "python3",
      hermesProfile: "/unused",
    }),
    true,
  );
  vi.spyOn(runtime, "start").mockResolvedValue();
  const call = vi
    .spyOn(runtime, "call")
    .mockResolvedValueOnce({ run_id: "category-run" })
    .mockResolvedValueOnce({ status: "completed", output });
  return { runtime, call };
}

describe("CART-01 SCN-CART-1 격리된 카테고리 추천", () => {
  it.each(['{"category":"식품"}', '```json\n{"category":"식품"}\n```'])(
    "이름과 카테고리 이름만 보내고 목록 안 답만 반환해요: %s",
    async (output) => {
      const { runtime, call } = setup(output);
      expect(
        await runtime.recommendCategory(
          "request-id",
          "두부",
          ["식품", "기타"],
          new AbortController().signal,
        ),
      ).toBe("식품");
      const body = call.mock.calls[0]![1] as {
        input: Array<{ content: string }>;
        instructions: string;
      };
      expect(JSON.parse(body.input[0]!.content)).toEqual({
        name: "두부",
        categories: ["식품", "기타"],
      });
      expect(body.instructions).toContain("Use no tools or memory");
    },
  );
  it("목록 밖 답은 무시해요", async () => {
    const { runtime } = setup('{"category":"다른 가정 카테고리"}');
    expect(
      await runtime.recommendCategory(
        "request-id",
        "두부",
        ["식품", "기타"],
        new AbortController().signal,
      ),
    ).toBeNull();
  });
});
