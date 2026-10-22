import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/shared/api", () => ({ request: state.request }));
import { removeCurrentPushSubscription } from "./subscriptions.browser";
afterEach(() => {
  vi.unstubAllGlobals();
  state.request.mockReset();
});
it("ACC-14 서버 구독 삭제 후 브라우저 구독을 해지한다", async () => {
  const unsubscribe = vi.fn().mockImplementation(async () => {
    expect(state.request).toHaveBeenCalledWith(
      "/api/push/subscriptions",
      { endpoint: "https://web.push.apple.com/test" },
      "PUT",
    );
    return true;
  });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: "https://web.push.apple.com/test",
            unsubscribe,
          }),
        },
      }),
    },
  });
  await removeCurrentPushSubscription();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it("ACC-14 푸시를 지원하지 않는 기기도 로그아웃할 수 있다", async () => {
  vi.stubGlobal("navigator", {});
  await removeCurrentPushSubscription();
  expect(state.request).not.toHaveBeenCalled();
});
it("ACC-14 서버 삭제 실패에도 브라우저 구독 해지를 시도한다", async () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  state.request.mockRejectedValueOnce(new Error("서버 삭제 실패"));
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: "https://web.push.apple.com/test",
            unsubscribe,
          }),
        },
      }),
    },
  });
  await expect(removeCurrentPushSubscription()).rejects.toThrow(
    "서버 삭제 실패",
  );
  expect(unsubscribe).toHaveBeenCalledOnce();
});
