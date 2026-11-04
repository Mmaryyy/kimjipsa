import { AuthSessionMissingError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setThemeMode } from "@/shared/lib";
import type * as SharedApi from "@/shared/api";
import AppearanceSettingsPage from ".";

vi.mock("../notification-settings", () => ({ default: () => <div /> }));
vi.mock("../home-settings", () => ({ default: () => <div /> }));
vi.mock("../account-settings", () => ({ default: () => <div /> }));
vi.mock("../household-settings", () => ({ default: () => <div /> }));
vi.mock("../ai-settings", () => ({ default: () => <div /> }));

const { signOut, assign } = vi.hoisted(() => ({
  signOut: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  createBrowserSupabaseClient: () => ({ auth: { signOut } }),
}));

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(["account"], { userId: "test-user" });
  queryClient.setQueryData(["family"], { name: "테스트 가정" });
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: ["profile"] });

  render(
    <QueryClientProvider client={queryClient}>
      <AppearanceSettingsPage />
    </QueryClientProvider>,
  );

  return queryClient;
}

describe("ACC-15 설정에서 로그아웃", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const location = window.location;
    vi.stubGlobal(
      "window",
      new Proxy(window, {
        get(target, key) {
          if (key === "location") return { ...location, assign };
          return Reflect.get(target, key, target);
        },
      }),
    );
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("계정 구역에서 확인 없이 로그아웃하고 모든 캐시를 비운 뒤 로그인으로 이동해요", async () => {
    const queryClient = renderSettings();
    assign.mockImplementation(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });

    expect(screen.getByRole("region", { name: "계정" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("로그아웃 중에는 버튼이 비활성화되고 중복 요청을 보내지 않아요", async () => {
    let finishSignOut!: (result: { error: null }) => void;
    signOut.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        finishSignOut = resolve;
      }),
    );
    const queryClient = renderSettings();
    const button = screen.getByRole("button", { name: "로그아웃" });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["account"])).toEqual({
      userId: "test-user",
    });

    await act(async () => finishSignOut({ error: null }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  });

  it.each(["응답 오류", "네트워크 오류"])(
    "%s가 나면 한국어 알림을 보여 주고 화면을 유지하며 재시도할 수 있어요",
    async (failure) => {
      const error = new Error("internal error");
      if (failure === "응답 오류") signOut.mockResolvedValueOnce({ error });
      else signOut.mockRejectedValueOnce(error);
      const queryClient = renderSettings();
      const button = screen.getByRole("button", { name: "로그아웃" });
      fireEvent.click(button);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "로그아웃하지 못했어요. 다시 시도해 주세요.",
      );
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(assign).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(["account"])).toEqual({
        userId: "test-user",
      });
      expect(queryClient.getQueryData(["family"])).toEqual({
        name: "테스트 가정",
      });

      fireEvent.click(button);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("이미 로그인되지 않은 상태여도 오류 없이 로그인으로 이동해요", async () => {
    signOut.mockResolvedValueOnce({ error: new AuthSessionMissingError() });
    const queryClient = renderSettings();
    queryClient.setQueryData(["account"], { userId: null });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ACC-12 화면 모드 저장", () => {
  it("같은 모드는 로컬 저장과 변경 알림을 반복하지 않아요", () => {
    document.documentElement.dataset.themeMode = "system";
    const persist = vi.spyOn(Storage.prototype, "setItem");
    const notify = vi.fn();
    window.addEventListener("kj:theme-mode", notify);
    try {
      setThemeMode("system");
      expect(persist).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      setThemeMode("dark");
      expect(persist).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledTimes(1);
      setThemeMode("dark");
      expect(persist).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledTimes(1);
    } finally {
      persist.mockRestore();
      window.removeEventListener("kj:theme-mode", notify);
      delete document.documentElement.dataset.themeMode;
      delete document.documentElement.dataset.theme;
    }
  });
});
