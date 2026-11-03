import { useEffect } from "react";
import {
  focusManager,
  QueryObserver,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import type * as SharedApi from "@/shared/api";
import type * as SharedUi from "@/shared/ui";
import { ToastProvider } from "@/shared/ui";
import { useAccount, useSignOut } from "@/features/account";
import { AccountGate } from "@/widgets/account-gate";
import { QueryProvider } from "./query-provider";

const toast = vi.hoisted(() => ({
  action: undefined as (() => void) | undefined,
  real: false,
}));
const accountRequest = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  request: (...args: unknown[]) => accountRequest(...args),
  createBrowserSupabaseClient: () => ({ auth: { signOut } }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace }),
}));
vi.mock("@/shared/ui", async (importOriginal) => {
  const original = await importOriginal<typeof SharedUi>();
  return {
    ...original,
    Toast: ({
      open,
      message,
      action,
      onOpenChange,
    }: {
      open: boolean;
      message: string;
      action: { label: string; onClick: () => void };
      onOpenChange: (open: boolean) => void;
    }) => {
      toast.action = action.onClick;
      if (toast.real)
        return (
          <original.Toast
            open={open}
            message={message}
            action={action}
            onOpenChange={onOpenChange}
            duration={Infinity}
          />
        );
      return open ? (
        <div role="status">
          {message}
          <button onClick={action.onClick}>{action.label}</button>
          <button onClick={() => onOpenChange(false)}>닫기</button>
        </div>
      ) : null;
    },
  };
});

let client: QueryClient;
function Requests() {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
  }, [queryClient]);
  return null;
}
function AccountScreen() {
  const account = useAccount();
  return account.isError ? (
    <p>계정 조회 오류</p>
  ) : (
    <p>{account.data?.profile?.displayName}님의 일정</p>
  );
}
function SignOutScreen() {
  const { onSignOut, pending, error } = useSignOut();
  return (
    <>
      <button onClick={onSignOut} disabled={pending}>
        로그아웃
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function gatedApp() {
  return (
    <QueryProvider>
      <Requests />
      <AccountGate splash={() => <p>스플래시</p>}>
        <AccountScreen />
      </AccountGate>
    </QueryProvider>
  );
}
async function settleAccountGate() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(900);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}
function confirmSignedIn() {
  act(() => {
    client.setQueryData(["account"], {
      userId: "signed-in-user",
      profile: { displayName: "지수", termsVersion: "beta-2026-10-30" },
      membership: null,
    });
  });
}
async function expireSession(kind: "query" | "mutation", key: string) {
  const fail = async () => {
    throw new ApiError("UNAUTHORIZED", "로그인 필요", 401);
  };
  await act(async () => {
    if (kind === "query")
      await client
        .fetchQuery({ queryKey: [key], queryFn: fail })
        .catch(() => {});
    else
      await client
        .getMutationCache()
        .build(client, { mutationFn: fail })
        .execute(undefined)
        .catch(() => {});
  });
}
function followToastAction() {
  const assign = vi.fn();
  const originalWindow = window;
  // 실제 문서 이동 대신 토스트 행동이 선택한 목적지만 확인해요.
  vi.stubGlobal("window", { location: { assign } });
  try {
    toast.action?.();
  } finally {
    vi.stubGlobal("window", originalWindow);
  }
  return assign;
}

describe("ACC-01 ACC-05 SCN-ACC-2 로그인 만료 안내", () => {
  afterEach(() => {
    cleanup();
    client?.clear();
    focusManager.setFocused(undefined);
    window.history.replaceState(null, "", "/");
    document.cookie = "kimjipsa-mock-stage=; Max-Age=0; Path=/";
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    toast.real = false;
  });

  it("ACC-14 로그아웃 중 쿼리 401은 만료 안내 없이 로그인 문서를 열어요", async () => {
    window.history.replaceState(null, "", "/settings");
    let finishSignOut!: (result: { error: null }) => void;
    signOut.mockImplementationOnce(
      () => new Promise((resolve) => (finishSignOut = resolve)),
    );
    render(
      <QueryProvider>
        <Requests />
        <SignOutScreen />
      </QueryProvider>,
    );
    confirmSignedIn();
    const cancelQueries = vi.spyOn(client, "cancelQueries");
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(cancelQueries).toHaveBeenCalledOnce();
    expect(client.getQueryData(["account"])).toMatchObject({
      userId: "signed-in-user",
    });
    await expireSession("query", "events-during-sign-out");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const assign = vi.fn();
    const originalWindow = window;
    vi.stubGlobal("window", { location: { assign } });
    try {
      await act(async () => finishSignOut({ error: null }));
    } finally {
      vi.stubGlobal("window", originalWindow);
    }
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("ACC-14 로그아웃 실패는 오류 문구를 보여 주고 다시 시도할 수 있어요", async () => {
    window.history.replaceState(null, "", "/settings");
    signOut.mockResolvedValue({ error: new Error("인증 오류") });
    render(
      <QueryProvider>
        <Requests />
        <SignOutScreen />
      </QueryProvider>,
    );
    confirmSignedIn();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "로그아웃하지 못했어요. 다시 시도해 주세요.",
    );
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
    expect(replace).not.toHaveBeenCalled();
  });

  it("ACC-14 로그아웃 실패와 재시도 중에도 게이트의 화면 내용을 유지해요", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    window.history.replaceState(null, "", "/settings");
    accountRequest.mockResolvedValue({
      userId: "signed-in-user",
      profile: { displayName: "지수", termsVersion: "beta-2026-10-30" },
      membership: { familyId: "family", role: "admin" },
    });
    signOut.mockResolvedValue({ error: new Error("인증 오류") });
    render(
      <QueryProvider>
        <Requests />
        <AccountGate splash={() => <p>스플래시</p>}>
          <AccountScreen />
          <SignOutScreen />
        </AccountGate>
      </QueryProvider>,
    );
    await settleAccountGate();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(screen.getByText("지수님의 일정")).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "로그아웃하지 못했어요",
      );
      expect(screen.queryByText("스플래시")).not.toBeInTheDocument();
    }
  });

  it("처음부터 로그아웃이면 스플래시 뒤 로그인 시작 화면으로 이동해요", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    accountRequest.mockResolvedValue({
      userId: null,
      profile: null,
      membership: null,
    });
    render(gatedApp());
    await settleAccountGate();
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.getByText("스플래시")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("로그인 확인 뒤 계정의 200 null 응답은 화면을 유지하고 같은 만료를 한 번만 안내해요", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    accountRequest.mockResolvedValue({
      userId: "signed-in-user",
      profile: { displayName: "지수", termsVersion: "beta-2026-10-30" },
      membership: { familyId: "family", role: "admin" },
    });
    render(gatedApp());
    await settleAccountGate();
    expect(screen.getByText("지수님의 일정")).toBeVisible();
    accountRequest.mockResolvedValue({
      userId: null,
      profile: null,
      membership: null,
    });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["account"] });
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("스플래시")).not.toBeInTheDocument();
    expect(screen.queryByText("계정 조회 오류")).not.toBeInTheDocument();
    expect(screen.getByText("지수님의 일정")).toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(followToastAction()).toHaveBeenCalledWith("/");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    const requestsAfterExpiry = accountRequest.mock.calls.length;
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(accountRequest).toHaveBeenCalledTimes(requestsAfterExpiry);
    await expireSession("mutation", "same-expiry");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["query", "mutation"] as const)(
    "일반 화면의 %s 401은 이동하지 않고 토스트 하나와 홈 버튼을 보여 줘요",
    async (kind) => {
      window.history.replaceState(null, "", "/calendar");
      // 목업 로그인 시점에서도 같은 오류 처리 경로를 사용해요.
      document.cookie = "kimjipsa-mock-stage=login; Path=/";
      render(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      confirmSignedIn();
      await expireSession(kind, "first");
      await expireSession(kind, "second");
      expect(window.location.pathname).toBe("/calendar");
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(
        "로그인이 풀렸어요. 다시 로그인해 주세요",
      );
      expect(screen.getByRole("button", { name: "홈으로 이동" })).toBeVisible();
      expect(followToastAction()).toHaveBeenCalledWith("/");
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      await expireSession(kind, "after-dismiss");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("계정 재조회로 다시 로그인하면 다음 만료를 안내해요", async () => {
    render(
      <QueryProvider>
        <Requests />
      </QueryProvider>,
    );
    confirmSignedIn();
    await expireSession("query", "before-login");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await act(async () => {
      await client.fetchQuery({
        queryKey: ["account"],
        queryFn: async () => ({ userId: "signed-in-again" }),
      });
    });
    await expireSession("query", "after-login");
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("안내를 닫고 창에 다시 포커스해도 만료된 조회와 안내를 반복하지 않아요", async () => {
    render(
      <QueryProvider>
        <Requests />
      </QueryProvider>,
    );
    confirmSignedIn();
    const request = vi.fn(async () => {
      throw new ApiError("UNAUTHORIZED", "로그인 필요", 401);
    });
    const observer = new QueryObserver(client, {
      queryKey: ["focus-events"],
      queryFn: request,
      initialData: [],
      refetchOnMount: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await act(async () => {
        await observer.refetch();
      });
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(request).toHaveBeenCalledOnce();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      unsubscribe();
    }
  });

  it("만료 뒤 개별 쿼리의 30초 주기 조회도 멈추고 마지막 데이터를 유지해요", async () => {
    vi.useFakeTimers();
    render(
      <QueryProvider>
        <Requests />
      </QueryProvider>,
    );
    confirmSignedIn();
    const request = vi.fn(async () => ["마지막 일정"]);
    const observer = new QueryObserver(client, {
      queryKey: ["polling-events"],
      queryFn: request,
      initialData: ["마지막 일정"],
      refetchOnMount: false,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(request).toHaveBeenCalledOnce();
      await expireSession("mutation", "session-expired");
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(request).toHaveBeenCalledOnce();
      expect(client.getQueryData(["polling-events"])).toEqual(["마지막 일정"]);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      unsubscribe();
    }
  });

  it("만료 중 다시 구독하거나 옵션을 바꿔도 멈추고 재로그인하면 주기 조회를 복원해요", async () => {
    vi.useFakeTimers();
    render(
      <QueryProvider>
        <Requests />
      </QueryProvider>,
    );
    confirmSignedIn();
    const request = vi.fn(async () => ["마지막 일정"]);
    const options = {
      queryKey: ["resumed-events"],
      queryFn: request,
      initialData: ["마지막 일정"],
      refetchOnMount: false,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
    };
    const observer = new QueryObserver(client, options);
    let unsubscribe = observer.subscribe(() => {});
    try {
      await expireSession("mutation", "expired-before-remount");
      unsubscribe();
      unsubscribe = observer.subscribe(() => {});
      observer.setOptions({
        ...options,
        enabled: true,
        refetchInterval: 5_000,
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(request).not.toHaveBeenCalled();
      expect(client.getQueryData(options.queryKey)).toEqual(["마지막 일정"]);
      await act(async () => {
        await client.fetchQuery({
          queryKey: ["account"],
          queryFn: async () => ({ userId: "signed-in-again" }),
        });
      });
      const callsAfterLogin = request.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(request.mock.calls.length).toBeGreaterThan(callsAfterLogin);
    } finally {
      unsubscribe();
    }
  });

  it("조회와 변경의 401이 동시에 도착해도 실제 토스트는 하나만 열리고 닫은 뒤 반복하지 않아요", async () => {
    toast.real = true;
    render(
      <ToastProvider>
        <QueryProvider>
          <Requests />
        </QueryProvider>
      </ToastProvider>,
    );
    confirmSignedIn();
    const fail = async () => {
      throw new ApiError("UNAUTHORIZED", "로그인 필요", 401);
    };
    await act(async () => {
      await Promise.allSettled([
        client.fetchQuery({ queryKey: ["simultaneous-events"], queryFn: fail }),
        client
          .getMutationCache()
          .build(client, { mutationFn: fail })
          .execute(undefined),
      ]);
    });
    // Radix의 일시적인 화면 읽기 도구용 복제 문구는 별도 알림으로 세지 않아요.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "홈으로 이동" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림 닫기" }));
    await expireSession("query", "simultaneous-after-close");
    expect(
      screen.queryByRole("button", { name: "홈으로 이동" }),
    ).not.toBeInTheDocument();
  });

  it("초대 수락 요청의 401은 버튼을 누를 때 초대 토큰을 유지해 로그인으로 보내요", async () => {
    window.history.replaceState(null, "", "/invite/one-time-token");
    render(
      <QueryProvider>
        <Requests />
      </QueryProvider>,
    );
    confirmSignedIn();
    await expireSession("mutation", "accept-invite");
    expect(window.location.pathname).toBe("/invite/one-time-token");
    expect(screen.getByRole("button", { name: "홈으로 이동" })).toBeVisible();
    expect(followToastAction()).toHaveBeenCalledWith(
      "/login?invite=one-time-token",
    );
  });

  it.each(["/login", "/onboarding", "/terms", "/privacy", "/dev/components"])(
    "%s에서는 조회와 저장이 401이어도 안내나 이동을 하지 않아요",
    async (path) => {
      window.history.replaceState(null, "", path);
      render(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      confirmSignedIn();
      await expireSession("query", "account");
      await expireSession("mutation", "save");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe(path);
    },
  );

  it.each(["unknown", "signed-out"])(
    "홈 첫 방문에서 계정이 %s이면 401 안내를 띄우지 않아요",
    async (accountState) => {
      document.cookie = "kimjipsa-mock-stage=login; Path=/";
      render(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      if (accountState === "signed-out") {
        act(() => {
          client.setQueryData(["account"], {
            userId: null,
            profile: null,
            membership: null,
          });
        });
      }
      await expireSession("query", "account");
      await expireSession("mutation", "save");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
    },
  );

  it.each(["/login", "/onboarding", "/onboarding/profile"])(
    "이미 열린 안내는 %s로 이동하면 닫히고 돌아와도 남아 있지 않아요",
    async (path) => {
      const view = render(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      confirmSignedIn();
      await expireSession("query", "events");
      expect(screen.getByRole("status")).toBeVisible();
      window.history.replaceState(null, "", path);
      view.rerender(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      window.history.replaceState(null, "", "/");
      view.rerender(
        <QueryProvider>
          <Requests />
        </QueryProvider>,
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );
});
