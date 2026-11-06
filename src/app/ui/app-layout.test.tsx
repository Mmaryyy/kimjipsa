import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/entities/user";
import { AppLayout } from "./app-layout";

const { useAccount, replace, route } = vi.hoisted(() => ({
  useAccount: vi.fn(),
  replace: vi.fn(),
  route: { pathname: "/" },
}));
vi.mock("@/widgets/account-gate/model/prefetch-home", () => ({
  prefetchHome: () => Promise.resolve(),
}));
vi.mock("@/features/account", () => ({
  useAccount,
  useBotCharacter: () => ({
    full: "/images/kimjipsa-dog-bird.png",
    ready: true,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace }),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockToolbar() {
      return <button>목업 도구</button>;
    },
}));
vi.mock("@/widgets/chat-panel", () => ({ ChatPanel: () => null }));
vi.mock("./sidebar-navigation", () => ({
  SidebarNavigation: () => <nav aria-label="사이드바" />,
}));
vi.mock("./bottom-navigation", () => ({
  default: () => <nav aria-label="하단 탭" />,
}));

const readyAccount: Account = {
  userId: "user",
  profile: { displayName: "지수", termsVersion: "beta-2026-10-30" },
  membership: { familyId: "family", role: "admin" },
};
function accountResult(data?: Account, error?: Error) {
  return {
    data,
    error,
    isPending: data === undefined && error === undefined,
    isError: error !== undefined,
    isFetching: false,
    refetch: vi.fn(),
  };
}
function app() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AppLayout>
        <button>화면 본문</button>
      </AppLayout>
    </QueryClientProvider>
  );
}
async function elapse(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}
function expectSplashOnly() {
  expect(
    screen.getByRole("status", { name: "김집사를 준비하고 있어요" }),
  ).toBeVisible();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
}

describe("ACC-01 SCN-ACC-1 첫 진입 계정 확인 스플래시", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    route.pathname = "/";
    useAccount.mockReturnValue(accountResult());
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

  it("서버 첫 HTML에는 로고와 준비 안내만 있고 본문과 내비게이션이 없어요", () => {
    useAccount.mockReturnValue(accountResult(readyAccount));
    const html = renderToString(app());
    expect(html).toContain("김집사를 준비하고 있어요");
    expect(html).toContain("splash-character");
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("화면 본문");
    expect(html).not.toContain("목업 도구");
    expect(html).not.toContain("skeleton");
  });

  it("빠른 계정 확인도 최소 2700ms와 200ms 페이드 후에만 셸을 보여 줘요", async () => {
    useAccount.mockReturnValue(accountResult(readyAccount));
    render(app());
    expectSplashOnly();
    await elapse(2699);
    expectSplashOnly();
    await elapse(1);
    expectSplashOnly();
    await elapse(199);
    expectSplashOnly();
    await elapse(1);
    expect(screen.getByRole("button", { name: "화면 본문" })).toBeVisible();
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("2700ms 뒤에도 조회 중이면 유지하고 조회가 끝나면 페이드해요", async () => {
    const view = render(app());
    await elapse(2700);
    expectSplashOnly();
    useAccount.mockReturnValue(accountResult(readyAccount));
    view.rerender(app());
    await elapse(0);
    await elapse(199);
    expectSplashOnly();
    await elapse(1);
    expect(screen.getByRole("button", { name: "화면 본문" })).toBeVisible();
  });

  it.each([
    [{ userId: null, profile: null, membership: null }, "/login"],
    [{ userId: "user", profile: null, membership: null }, "/onboarding"],
    [{ ...readyAccount, membership: null }, "/onboarding"],
  ] as const)(
    "로그인과 가입 이동 중에도 셸을 노출하지 않아요: %j",
    async (account, destination) => {
      useAccount.mockReturnValue(accountResult(account));
      render(app());
      await elapse(2700);
      expect(replace).not.toHaveBeenCalled();
      await elapse(200);
      expect(replace).toHaveBeenCalledWith(destination);
      expectSplashOnly();
    },
  );

  it("동작 줄이기에서는 900ms 후 페이드 대기 없이 홈을 보여 줘요", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    useAccount.mockReturnValue(accountResult(readyAccount));
    render(app());
    await elapse(899);
    expectSplashOnly();
    await elapse(1);
    await elapse(1);
    expect(screen.getByRole("button", { name: "화면 본문" })).toBeVisible();
  });

  it("로그인 후 앱 안에서 탭을 바꾸면 스플래시를 다시 띄우지 않아요", async () => {
    useAccount.mockReturnValue(accountResult(readyAccount));
    const view = render(app());
    await elapse(2700);
    await elapse(200);
    route.pathname = "/calendar";
    view.rerender(app());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "화면 본문" })).toBeVisible();
  });

  it.each(["/login", "/onboarding", "/invite/test-token"])(
    "공개 화면 %s의 기존 흐름을 가로막지 않아요",
    (pathname) => {
      route.pathname = pathname;
      render(app());
      expect(useAccount).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "화면 본문" })).toBeVisible();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("계정 조회 실패도 스플래시 뒤 재시도를 보여 주고 셸은 숨겨요", async () => {
    useAccount.mockReturnValue(
      accountResult(undefined, new Error("연결을 확인해 주세요")),
    );
    render(app());
    await elapse(2700);
    await elapse(200);
    expect(screen.getByText("연결을 확인해 주세요")).toBeVisible();
    expect(screen.getByRole("button", { name: "다시 시도하기" })).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
