import { AuthSessionMissingError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SharedApi from "@/shared/api";
import { AppearanceSettingsPage } from "./appearance-settings-page";

vi.mock("./home-settings", () => ({ HomeSettings: () => <div /> }));

const { signOut, replace } = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
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
    signOut.mockResolvedValue({ error: null });
  });

  it("계정 구역에서 확인 없이 로그아웃하고 모든 캐시를 비운 뒤 로그인으로 이동해요", async () => {
    const queryClient = renderSettings();
    replace.mockImplementation(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });

    expect(screen.getByRole("region", { name: "계정" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
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
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["account"])).toBeDefined();

    await act(async () => finishSignOut({ error: null }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it.each(["응답 오류", "네트워크 오류"])(
    "%s가 나면 한국어 알림을 보여 주고 캐시와 화면을 유지하며 재시도할 수 있어요",
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
      expect(replace).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(["account"])).toBeDefined();
      expect(queryClient.getQueryData(["family"])).toBeDefined();

      fireEvent.click(button);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("이미 로그인되지 않은 상태여도 오류 없이 로그인으로 이동해요", async () => {
    signOut.mockResolvedValueOnce({ error: new AuthSessionMissingError() });
    const queryClient = renderSettings();
    queryClient.setQueryData(["account"], { userId: null });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
