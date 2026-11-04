// @vitest-environment node
import { expect, it, vi } from "vitest";
import { configSchema } from "./config.mts";
import {
  contextSchema,
  HermesRuntime,
  runtimeConfigSchema,
} from "./hermes.mts";

it("BOT-07 주관식 답장을 보낼 때 직전 집사 질문도 Hermes 입력에 포함해요", async () => {
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
  const history = [
    { role: "user", text: "치과 일정을 등록해 줘", choices: [] },
    {
      role: "assistant",
      text: "공개 범위는요?",
      choices: [
        { label: "공유 일정", value: "shared" },
        { label: "개인 일정", value: "private" },
      ],
    },
  ];
  const context = contextSchema.parse({
    kind: "chat",
    actorId: "10000000-0000-4000-8000-000000000001",
    visibility: "private",
    now: "2026-11-04T03:00:00Z",
    message: { text: "내일 오후 3시", attachment_ids: [] },
    history,
    cart: [],
    events: [],
    eventCategories: [],
    calendarRange: { start: "2026-11-04", end: "2026-11-30" },
    memories: [],
    inventory: [],
    units: [],
    categories: [],
    locations: [],
    attachments: [],
  });
  const configuration = runtimeConfigSchema.parse({
    familyId: context.actorId,
    workerId: context.actorId,
    connectionMode: "local",
    capabilitiesVersion: 2,
    version: 1,
    memoryVersion: 1,
    name: "집사",
    memoryEnabled: false,
  });
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ run_id: "fixture-run" }),
  );
  vi.spyOn(runtime, "start").mockResolvedValue();
  vi.spyOn(runtime, "call").mockResolvedValue({
    status: "completed",
    output: JSON.stringify({ kind: "reply", text: "어떤 카테고리인가요?" }),
  });
  vi.stubGlobal("fetch", fetcher);
  try {
    const result = await runtime.run(
      "fixture-job",
      configuration,
      context,
      [],
      new AbortController().signal,
      async () => {},
    );
    const request = fetcher.mock.calls[0];
    const body = JSON.parse(request[1]?.body as string);
    expect(JSON.parse(body.input[0].content[0].text)).toMatchObject({
      history,
      message: context.message,
    });
    expect(result).toMatchObject({ kind: "reply", choices: [] });
  } finally {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});
