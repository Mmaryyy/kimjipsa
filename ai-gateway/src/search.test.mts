// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configSchema } from "./config.mts";
import { searchWeb } from "./search.mts";
import { withSnapshotChecks } from "./actions.mts";
let fixture: string;
beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), "kimjipsa-search-test-"));
  await mkdir(join(fixture, "tools"));
  await writeFile(join(fixture, "hermes_bootstrap.py"), "");
  await writeFile(
    join(fixture, "tools", "web_tools.py"),
    `import json, os\ndef web_search_tool(query, limit):\n    assert query == "김치 보관"\n    assert limit == 5\n    assert "SUPABASE_SERVICE_ROLE_KEY" not in os.environ\n    print("provider internal log must not escape")\n    return json.dumps({"success":True,"data":{"web":[{"title":"보관 정보","url":"https://example.com/storage","description":"설명"},{"url":"javascript:alert(1)"},{"url":"https://user:secret@example.com"}]}})\n`,
  );
});
afterAll(async () => {
  await rm(fixture, { recursive: true, force: true });
});
const config = () =>
  configSchema.parse({
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.com",
    supabaseAnonKey: "fake",
    workerEmail: "worker@example.com",
    hermesCommand: "hermes",
    hermesPython: "python3",
    hermesSource: fixture,
    hermesProfile: "/unused",
  });
describe("BOT-06 웹 검색 격리", () => {
  it("검색어만 Hermes 검색 경계에 보내고 안전한 출처만 돌려줘요", async () => {
    const result = await searchWeb(
      config(),
      "김치 보관",
      "김치 보관 검색해줘",
      new AbortController().signal,
    );
    expect(result).toEqual([
      {
        title: "보관 정보",
        url: "https://example.com/storage",
        description: "설명",
      },
    ]);
  });
  it("현재 메시지에 없는 가족 정보를 검색어로 추가하지 못해요", async () => {
    await expect(
      searchWeb(
        config(),
        "김치 보관 가족 비밀",
        "김치 보관 검색해줘",
        new AbortController().signal,
      ),
    ).rejects.toThrow("invalid_response");
  });
  it("취소된 검색은 결과를 적용하지 않아요", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      searchWeb(config(), "김치 보관", "김치 보관 검색해줘", controller.signal),
    ).rejects.toThrow("web_search_unavailable");
  });
});
describe("BOT-07 INV-16 서버 스냅샷", () => {
  it("모델이 만든 리비전 대신 일정 시리즈·재고·장바구니의 서버 값을 사용해요", () => {
    const revision = "a".repeat(32);
    const actions = withSnapshotChecks(
      [
        {
          domain: "event",
          label: "일정 변경",
          payload: { id: "series" },
          expected: { forged: "b".repeat(32) },
        },
      ],
      {
        events: [{ id: "series~2026-11-01", seriesId: "series", revision }],
        inventory: [{ id: "stock", revision }],
        cart: [{ id: "cart", revision }],
      },
    );
    expect(actions[0].expected).toEqual({
      series: revision,
      stock: revision,
      cart: revision,
    });
  });
});
