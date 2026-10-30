import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountGate } from "./account-gate";

const { prepare, route, account } = vi.hoisted(() => ({
  prepare: vi.fn(),
  route: { pathname: "/" },
  account: {
    data: {
      userId: "user",
      profile: {
        displayName: "테스트",
        termsVersion: "beta-2026-10-30" as string | null,
      },
      membership: {},
    },
    isPending: false,
  },
}));
vi.mock("../model/prefetch-home", () => ({ prefetchHome: prepare }));
vi.mock("@/features/account", () => ({
  useAccount: () => account,
  useSignOut: () => ({ onSignOut: vi.fn(), pending: false, error: null }),
  withdrawAccount: vi.fn(),
  ProfileForm: () => <p>동의 폼</p>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

function mount() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <AccountGate
        splash={(leaving) => <p>{leaving ? "페이드" : "스플래시"}</p>}
      >
        <p>오늘 화면</p>
      </AccountGate>
    </QueryClientProvider>,
  );
  return client;
}
async function elapse(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe("ACC-12 CAL-07 P4.12 첫 화면 미리 불러오기", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    route.pathname = "/";
    prepare.mockReset();
    account.data.profile.termsVersion = "beta-2026-10-30";
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("SCN-CAL-10 완료해도 최소 900ms와 200ms 페이드 뒤에 화면을 보여 줘요", async () => {
    prepare.mockResolvedValue(undefined);
    const client = mount();
    expect(prepare).toHaveBeenCalledWith(client);
    await elapse(899);
    expect(screen.getByText("스플래시")).toBeVisible();
    await elapse(1);
    expect(screen.getByText("페이드")).toBeVisible();
    await elapse(200);
    expect(screen.getByText("오늘 화면")).toBeVisible();
  });
  it("SCN-CAL-10 3초를 넘긴 요청도 페이드 뒤 화면 진입을 막지 않아요", async () => {
    prepare.mockReturnValue(new Promise(() => {}));
    mount();
    await elapse(2999);
    expect(screen.getByText("스플래시")).toBeVisible();
    await elapse(1);
    expect(screen.getByText("페이드")).toBeVisible();
    await elapse(200);
    expect(screen.getByText("오늘 화면")).toBeVisible();
  });
  it("SCN-CAL-10 일부 조회가 실패해도 준비가 끝나면 진입해요", async () => {
    prepare.mockImplementation(() =>
      Promise.allSettled([Promise.reject(new Error("조회 실패"))]),
    );
    mount();
    await elapse(900);
    await elapse(200);
    expect(screen.getByText("오늘 화면")).toBeVisible();
  });
  it.each(["draft-2026-10-16", null])(
    "ACC-02 SCN-ACC-1 동의 버전 %s는 앱과 사전 조회 대신 재동의 폼을 보여 줘요",
    async (termsVersion) => {
      account.data.profile.termsVersion = termsVersion;
      mount();
      await elapse(900);
      await elapse(200);
      expect(screen.getByText("동의 폼")).toBeVisible();
      expect(screen.getByRole("button", { name: "로그아웃" })).toBeVisible();
      expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeVisible();
      expect(screen.queryByText("오늘 화면")).not.toBeInTheDocument();
      expect(prepare).not.toHaveBeenCalled();
    },
  );
  it("홈이 아닌 경로는 미리 불러오기를 기다리지 않아요", async () => {
    route.pathname = "/calendar";
    mount();
    await elapse(900);
    await elapse(200);
    expect(prepare).not.toHaveBeenCalled();
    expect(screen.getByText("오늘 화면")).toBeVisible();
  });
});
