import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginFlow } from "./login-flow";

const { fetchAccount, replace } = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/features/account/api/api", () => ({ fetchAccount }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function renderLogin(inviteToken?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LoginFlow inviteToken={inviteToken} />
    </QueryClientProvider>,
  );
}

describe("ACC-01 SCN-ACC-1 로그인 화면 세션 확인", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([
    [
      { displayName: "살림이" },
      { familyId: "family", role: "admin" },
      undefined,
      "/",
    ],
    [null, null, undefined, "/onboarding"],
    [
      { displayName: "살림이" },
      null,
      "test-token",
      "/onboarding?invite=test-token",
    ],
  ])(
    "로그인된 사용자는 상태에 맞는 화면으로 이동해요",
    async (profile, membership, token, destination) => {
      fetchAccount.mockResolvedValue({
        userId: "test-user",
        profile,
        membership,
      });
      renderLogin(token);
      await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeVisible();
    },
  );
  it("로그인되지 않은 사용자에게만 로그인 버튼을 보여 줘요", async () => {
    fetchAccount.mockResolvedValue({
      userId: null,
      profile: null,
      membership: null,
    });
    renderLogin();
    expect(
      await screen.findByRole("button", { name: "카카오 로그인" }),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
  it("조회 중에는 스켈레톤을, 실패하면 재시도를 보여 줘요", async () => {
    fetchAccount.mockRejectedValue(new Error("연결을 확인해 주세요"));
    renderLogin();
    expect(screen.getByRole("status")).toBeVisible();
    expect(await screen.findByText("연결을 확인해 주세요")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "카카오 로그인" }),
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
