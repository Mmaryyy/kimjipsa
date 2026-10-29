import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  cleanup: vi.fn(),
  signOut: vi.fn(),
  request: vi.fn(),
  assign: vi.fn(),
}));
vi.mock("@/entities/notification", () => ({
  removeCurrentPushSubscription: state.cleanup,
}));
vi.mock("@/shared/api", () => ({
  request: state.request,
  createBrowserSupabaseClient: () => ({ auth: { signOut: state.signOut } }),
}));
vi.mock("@/shared/config", () => ({
  isMockDataEnabled: () => false,
  accountApiRoutes: { withdraw: "/api/account/withdraw" },
  accountRoutes: { login: "/login" },
}));
import { signOut, withdrawAccount } from "./api";
beforeEach(() => {
  state.request.mockReset().mockResolvedValue(null);
  state.assign.mockReset();
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

afterEach(() => vi.unstubAllGlobals());
it("ACC-15 SCN-ACC-6 탈퇴 성공 후 구독 정리 실패에도 로그인으로 이동해요", async () => {
  vi.stubGlobal("window", { location: { assign: state.assign } });
  state.cleanup.mockImplementation(async () => {
    expect(state.request).toHaveBeenCalledWith("/api/account/withdraw", {});
    throw new Error("기기 구독 해지 실패");
  });
  await withdrawAccount();
  expect(state.cleanup).toHaveBeenCalledOnce();
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(state.assign).toHaveBeenCalledWith("/login");
});
it("ACC-15 SCN-ACC-6 탈퇴가 거부되면 구독과 로그인 상태를 유지해요", async () => {
  state.request.mockRejectedValueOnce(new Error("관리자를 지정해 주세요."));
  await expect(withdrawAccount()).rejects.toThrow("관리자를 지정해 주세요.");
  expect(state.cleanup).not.toHaveBeenCalled();
  expect(state.signOut).not.toHaveBeenCalled();
});
