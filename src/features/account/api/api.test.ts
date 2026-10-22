import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ cleanup: vi.fn(), signOut: vi.fn() }));
vi.mock("@/entities/notification", () => ({
  removeCurrentPushSubscription: state.cleanup,
}));
vi.mock("@/shared/api", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signOut: state.signOut } }),
}));
vi.mock("@/shared/config", () => ({ isMockDataEnabled: () => false }));
import { signOut } from "./api";
beforeEach(() => {
  state.cleanup.mockReset().mockResolvedValue(undefined);
  state.signOut.mockReset().mockResolvedValue({ error: null });
});
it("ACC-14 로그아웃 전에 현재 기기 푸시 구독을 정리한다", async () => {
  state.cleanup.mockImplementation(async () => {
    expect(state.signOut).not.toHaveBeenCalled();
  });
  await signOut();
  expect(state.cleanup).toHaveBeenCalledOnce();
  expect(state.signOut).toHaveBeenCalledOnce();
});
it("ACC-14 구독 정리 실패에도 로그아웃을 계속 진행한다", async () => {
  state.cleanup.mockRejectedValueOnce(new Error("구독 삭제 실패"));
  await expect(signOut()).resolves.toBeUndefined();
  expect(state.signOut).toHaveBeenCalledOnce();
});
it("ACC-14 구독 정리 실패 뒤 인증 로그아웃 오류는 사용자에게 전달한다", async () => {
  state.cleanup.mockRejectedValueOnce(new Error("기기 해지 실패"));
  state.signOut.mockResolvedValueOnce({ error: new Error("인증 오류") });
  await expect(signOut()).rejects.toThrow("로그아웃하지 못했어요");
});
