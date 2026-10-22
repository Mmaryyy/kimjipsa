// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: state.rpc }),
}));
vi.mock("@/shared/server", () => ({
  throwDatabaseError: (error: unknown) => {
    if (error) throw error;
  },
}));
vi.mock("./web-push.server", () => ({
  vapidConfigured: () => true,
  sendWebPush: state.send,
}));
import { dispatchPendingPush } from "./worker.server";
beforeEach(() => {
  state.rpc.mockReset();
  state.send.mockReset();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
});
afterEach(() => vi.unstubAllEnvs());
it("CAL-09/11 이미 선점한 알림을 반복 발송하지 않고 만료 구독을 삭제한다", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const subscription = {
    endpoint: "https://web.push.apple.com/test",
    keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) },
  };
  const claimed = {
    id,
    user_id: id,
    family_id: id,
    kind: "event_reminder",
    payload: { eventId: id },
    read_at: null,
    created_at: "2026-10-22T04:30:00Z",
    subscriptions: [subscription],
  };
  state.rpc
    .mockResolvedValueOnce({ data: [claimed], error: null })
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: [], error: null });
  state.send.mockResolvedValue("expired");
  await dispatchPendingPush();
  await dispatchPendingPush();
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenCalledWith(
    "notification_worker",
    expect.objectContaining({
      operation: "delete_subscription",
      input: { userId: id, endpoint: subscription.endpoint },
    }),
  );
});
it("CAL-09/11 일시 실패한 기기만 선점을 풀고 다음 호출에서 재시도한다", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const sent = {
    endpoint: "https://web.push.apple.com/sent",
    keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) },
  };
  const retry = { ...sent, endpoint: "https://web.push.apple.com/retry" };
  const entry = {
    id,
    user_id: id,
    family_id: id,
    kind: "event_reminder",
    payload: { eventId: id },
    read_at: null,
    created_at: "2026-10-22T04:30:00Z",
  };
  state.rpc
    .mockResolvedValueOnce({
      data: [{ ...entry, subscriptions: [sent, retry] }],
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({
      data: [{ ...entry, subscriptions: [retry] }],
      error: null,
    });
  state.send
    .mockResolvedValueOnce("sent")
    .mockResolvedValueOnce("retry")
    .mockResolvedValueOnce("sent");
  await dispatchPendingPush();
  await dispatchPendingPush();
  const releases = state.rpc.mock.calls.filter(
    ([, args]) => args.operation === "release_push",
  );
  expect(releases).toHaveLength(1);
  expect(releases[0]?.[1].input).toEqual({
    notificationId: id,
    endpoint: retry.endpoint,
  });
  expect(
    state.send.mock.calls.map(([subscription]) => subscription.endpoint),
  ).toEqual([sent.endpoint, retry.endpoint, retry.endpoint]);
  expect(
    state.rpc.mock.calls.some(
      ([, args]) => args.operation === "delete_subscription",
    ),
  ).toBe(false);
});
