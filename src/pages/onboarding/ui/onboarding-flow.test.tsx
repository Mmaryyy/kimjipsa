import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as FamilyModule from "@/features/family";
import { accountApiRoutes } from "@/shared/config";
import { OnboardingFlow } from "./onboarding-flow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/features/account", () => ({
  useAccount: () => ({
    data: { userId: "me", profile: { displayName: "민지" }, membership: null },
    isPending: false,
    isError: false,
  }),
  LoginIntroduction: () => <p>김집사</p>,
  LoginButtons: () => <button>로그인</button>,
  ProfileForm: () => <input aria-label="표시 이름" />,
}));
vi.mock("@/features/family", async (original) => ({
  ...(await original<typeof FamilyModule>()),
  CreateFamilyForm: ({ onCreated }: { onCreated: () => void }) => (
    <button onClick={onCreated}>우리 집 만들기</button>
  ),
}));

describe("ACC-05 SCN-ACC-1 가입 초대 링크 재사용", () => {
  it("4단계에서 이전으로 갔다 돌아와도 초대는 한 번만 생성해요", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, options) => {
        let data;
        if (url === accountApiRoutes.family && options?.method === "GET") {
          data = { id: "our-family", name: "우리 집", members: [] };
        } else if (
          url === accountApiRoutes.invites &&
          options?.method === "POST"
        ) {
          data = { token: "one-invite", expiresAt: "2026-10-22T00:00:00Z" };
        } else {
          throw new Error(`예상하지 못한 요청: ${options?.method} ${url}`);
        }
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
        });
      });
    const inviteRequests = () =>
      request.mock.calls.filter(
        ([url, options]) =>
          url === accountApiRoutes.invites && options?.method === "POST",
      );
    try {
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { mutations: { retry: false } } })
          }
        >
          <OnboardingFlow />
        </QueryClientProvider>,
      );
      expect(
        screen.getByRole("progressbar", { name: "가입 진행" }),
      ).toHaveAttribute("value", "3");
      fireEvent.click(screen.getByRole("button", { name: "우리 집 만들기" }));
      const link = await screen.findByRole("group", { name: "초대 링크 값" });
      expect(link).toHaveTextContent(
        `${window.location.origin}/invite/one-invite`,
      );
      expect(inviteRequests()).toHaveLength(1);
      expect(link.querySelector("code")).toHaveAttribute("tabindex", "0");
      fireEvent.click(screen.getByRole("button", { name: "‹ 이전" }));
      expect(
        screen.queryByRole("group", { name: "초대 링크 값" }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "초대 링크로 계속" }));
      await waitFor(() =>
        expect(
          screen.getByRole("group", { name: "초대 링크 값" }),
        ).toHaveTextContent(`${window.location.origin}/invite/one-invite`),
      );
      expect(inviteRequests()).toHaveLength(1);
      expect(screen.getByRole("progressbar")).toHaveAttribute("value", "4");
    } finally {
      request.mockRestore();
    }
  });
});
