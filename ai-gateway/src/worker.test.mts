// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { agentResultSchema } from "../../src/entities/chat-message/model/chat.schema.ts";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  rpc: vi.fn(),
  fetch: vi.fn(),
  stop: vi.fn(),
  shutdown: () => {},
  context: { kind: "chat", attachments: [] as unknown[] },
}));
vi.mock("node:http", () => ({
  createServer: () => ({
    once: vi.fn(),
    listen: (_port: number, _host: string, ready: () => void) => ready(),
    close: vi.fn(),
  }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("./config.mts", () => ({
  gatewayRoot: "/unused/",
  loadConfig: async () => ({ appUrl: "http://localhost:3000" }),
  workerPassword: async () => "test-password",
}));
vi.mock("./hermes.mts", () => ({
  contextSchema: { parse: () => mocks.context },
  runtimeConfigSchema: {
    safeParse: () => ({ success: true, data: { version: 1 } }),
  },
  HermesRuntime: class {
    ready = vi.fn();
    run = mocks.run;
    finish = vi.fn();
    stop = mocks.stop;
  },
}));
vi.mock("./actions.mts", () => ({
  withSnapshotChecks: (actions: unknown[]) => actions,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: "worker" } } }),
      getSession: async () => ({ data: { session: { access_token: "test" } } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      stopAutoRefresh() {},
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob(["photo"]) }),
      }),
    },
    channel: () => ({
      on() {
        return this;
      },
      subscribe(ready: (status: string) => void) {
        ready("SUBSCRIBED");
        return {};
      },
    }),
    removeChannel: vi.fn(),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["chat", false, "actions", true, "action_proposal"],
  ["chat", false, "add", true, "action_proposal"],
  ["chat", false, "proposal", true, "action_proposal"],
  ["chat", false, "action_proposal", true, "action_proposal"],
  ["chat", false, "reply", false, "reply"],
  ["chat", false, "actions", false, "confirmation_required"],
  ["chat", false, "add", false, "confirmation_required"],
  ["chat", false, "proposal", false, "confirmation_required"],
  ["chat", true, "actions", true, "confirmation_required"],
  ["chat", true, "add", true, "confirmation_required"],
  ["chat", true, "proposal", true, "confirmation_required"],
  ["summary", false, "actions", true, "confirmation_required"],
  ["summary", false, "add", true, "confirmation_required"],
  ["summary", false, "proposal", true, "confirmation_required"],
] as const)(
  "BOT-07 워커 완료 요청: %s images=%s kind=%s actions=%s → %s",
  async (contextKind, hasImages, kind, hasActions, expected) => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.context = {
      kind: contextKind,
      attachments: hasImages ? [{ path: "photo", mime_type: "image/png" }] : [],
    };
    const actions = hasActions
      ? [{ domain: "cart", label: "우유 2개 담기", payload: {}, expected: {} }]
      : [];
    mocks.run.mockResolvedValue({
      ...agentResultSchema.parse({
        kind: "reply",
        actions,
        text: "우유 2개 담기",
      }),
      kind,
    });
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process, "once").mockImplementation((event, listener) => {
      if (event === "SIGTERM") mocks.shutdown = listener;
      return process;
    });
    let claimed = false;
    mocks.rpc.mockImplementation(
      async (_name: string, { operation }: { operation: string }) => {
        if (operation !== "claim") return { data: null };
        if (claimed) {
          mocks.shutdown();
          return { data: null };
        }
        claimed = true;
        return {
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            familyId: "22222222-2222-4222-8222-222222222222",
            leaseToken: "33333333-3333-4333-8333-333333333333",
            configVersion: 1,
            memoryVersion: 1,
            kind: contextKind,
            hermesRunId: null,
          },
        };
      },
    );
    mocks.fetch.mockImplementation(async (url: URL, init: RequestInit) => {
      if (url.pathname === "/api/agent/complete") {
        const body = JSON.parse(String(init.body));
        if (["actions", "add", "proposal"].includes(body.kind))
          return Response.json(
            { ok: false, error: { code: "confirmation_required" } },
            { status: 400 },
          );
      }
      return Response.json({ ok: true, data: null });
    });
    vi.stubGlobal("fetch", mocks.fetch);

    await import("./worker.mts");

    const completion = mocks.fetch.mock.calls.find(
      ([url]) => url.pathname === "/api/agent/complete",
    );
    if (expected === "confirmation_required") {
      expect(mocks.rpc).toHaveBeenCalledWith("agent_command", {
        operation: "fail",
        input: expect.objectContaining({ code: expected }),
      });
      if (completion) expect(JSON.parse(completion[1].body).kind).toBe(kind);
    } else {
      expect(completion).toBeDefined();
      expect(JSON.parse(completion![1].body)).toMatchObject({
        kind: expected,
        actions,
      });
      expect(
        mocks.rpc.mock.calls.some(
          ([op, input]) => op === "agent_command" && input.operation === "fail",
        ),
      ).toBe(false);
    }
    expect(mocks.stop).toHaveBeenCalled();
  },
);
