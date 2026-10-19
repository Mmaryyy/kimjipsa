import type { ComponentProps } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginFlow } from "./login-flow";
import { LoginPage } from "./login-page";

const { fetchAccount, replace, push, back } = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));
vi.mock("@/features/account/api/api", () => ({ fetchAccount }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, back }),
}));

function renderLogin(props: ComponentProps<typeof LoginFlow> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const tree = (next: ComponentProps<typeof LoginFlow>) => (
    <QueryClientProvider client={client}>
      <LoginFlow {...next} />
    </QueryClientProvider>
  );
  const view = render(tree(props));
  return {
    show: (next: ComponentProps<typeof LoginFlow>) => view.rerender(tree(next)),
  };
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
      renderLogin({ inviteToken: token });
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
    renderLogin({ loginRequested: true });
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

describe("ACC-01 SCN-ACC-1 시작 화면과 로그인 1단계", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchAccount.mockResolvedValue({
      userId: null,
      profile: null,
      membership: null,
    });
  });

  it.each([
    [{}, "시작하기"],
    [{ step: "login" }, "카카오 로그인"],
    [{ invite: "test-token" }, "카카오 로그인"],
    [{ error: "identity" }, "카카오 로그인"],
  ] as const)(
    "페이지 쿼리에 맞는 화면으로 진입해요: %j",
    async (params, button) => {
      const page = await LoginPage({ searchParams: Promise.resolve(params) });
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          {page}
        </QueryClientProvider>,
      );
      expect(await screen.findByRole("button", { name: button })).toBeVisible();
    },
  );

  it("첫 화면은 로고와 포커스된 시작하기만 보여 줘요", async () => {
    renderLogin();
    const start = await screen.findByRole("button", { name: "시작하기" });
    expect(start).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("img", {
        name: "팔에 흰 수건을 걸친 강아지 집사와 어깨 위 작은 노란 새",
      }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "김집사" })).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("장바구니")).not.toBeInTheDocument();
  });

  it("시작하기는 방문 기록을 추가하고 URL을 되돌리면 시작 화면을 보여 줘요", async () => {
    const view = renderLogin();
    fireEvent.click(await screen.findByRole("button", { name: "시작하기" }));
    expect(push).toHaveBeenCalledWith("/login?step=login");
    view.show({ loginRequested: true });
    expect(screen.getByRole("progressbar", { name: "가입 진행" })).toHaveValue(
      1,
    );
    expect(screen.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
    expect(screen.getByRole("button", { name: "‹ 이전" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "‹ 이전" }));
    expect(back).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    view.show({});
    expect(screen.getByRole("button", { name: "시작하기" })).toHaveFocus();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it.each([
    { inviteToken: "test-token" },
    { error: "identity" },
    { error: "" },
  ])(
    "초대나 오류 쿼리가 있으면 바로 로그인 화면을 보여 줘요: %j",
    async (props) => {
      renderLogin(props);
      expect(
        await screen.findByRole("button", { name: "카카오 로그인" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "시작하기" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveValue(1);
      if (props.error === "identity") {
        expect(
          screen.getByText(
            "다른 로그인 수단으로 시도하거나 서비스 운영자에게 문의해 주세요",
          ),
        ).toBeVisible();
      }
      expect(
        screen.queryByRole("button", { name: "‹ 이전" }),
      ).not.toBeInTheDocument();
      expect(back).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );
});
