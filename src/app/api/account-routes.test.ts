// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { authCallbackGET } from "./account-routes";

const { exchangeCodeForSession, signOut, authenticatedClient } = vi.hoisted(
  () => ({
    exchangeCodeForSession: vi.fn(),
    signOut: vi.fn(),
    authenticatedClient: vi.fn(),
  }),
);
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", () => ({
  isServerMockDataEnabled: async () => false,
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession, signOut },
  }),
}));
vi.mock("@/entities/user/index.server", () => ({ authenticatedClient }));
vi.mock("@/entities/family/index.server", () => ({}));

describe("ACC-01 SCN-ACC-1 OAuth 콜백", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    authenticatedClient.mockResolvedValue({});
    signOut.mockResolvedValue({ error: null });
  });
  it.each([undefined, "test token"])(
    "계정 분리 위반이면 로그아웃을 마친 뒤 identity 오류로 이동해요 (%s)",
    async (token) => {
      authenticatedClient.mockRejectedValue(
        new ApiError("identity_policy_violation", "계정 확인 실패"),
      );
      let finishSignOut!: () => void;
      signOut.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishSignOut = resolve;
          }),
      );
      const url = new URL("https://example.test/auth/callback?code=test-code");
      if (token) url.searchParams.set("invite", token);
      let finished = false;
      const pending = authCallbackGET(new Request(url)).then((response) => {
        finished = true;
        return response;
      });
      await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
      expect(finished).toBe(false);
      finishSignOut();
      const response = await pending;
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("error")).toBe("identity");
      expect(location.searchParams.get("invite")).toBe(token ?? null);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    },
  );
  it.each([
    ["", "/onboarding"],
    ["&invite=test-token", "/invite/test-token"],
  ])("정상 로그인은 다음 단계로 이동해요 (%s)", async (query, path) => {
    const response = await authCallbackGET(
      new Request(`https://example.test/auth/callback?code=test-code${query}`),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe(path);
    expect(signOut).not.toHaveBeenCalled();
  });
  it("코드 교환 실패는 OAuth 오류를 보여 줘요", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("failed") });
    const response = await authCallbackGET(
      new Request("https://example.test/auth/callback?code=test-code"),
    );
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?error=oauth",
    );
    expect(authenticatedClient).not.toHaveBeenCalled();
  });
});
