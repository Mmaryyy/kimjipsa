import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/entities/user";
import { ApiError } from "@/shared/api";
import { InvitePage } from "./invite-page";

const { fetchAccount, fetchInvite, acceptInvite, replace } = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  fetchInvite: vi.fn(),
  acceptInvite: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/features/account/api/api", () => ({ fetchAccount }));
vi.mock("@/features/family/api/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchInvite,
  acceptInvite,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const account: Account = {
  userId: "test-user",
  profile: { displayName: "살림이", termsVersion: "beta-2026-11-11" },
  membership: null,
};

function renderInvite() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InvitePage token="test-token" />
    </QueryClientProvider>,
  );
  return client;
}

describe("ACC-04 ACC-05 SCN-ACC-2·3 초대 수락", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchAccount.mockResolvedValue(account);
    fetchInvite.mockResolvedValue({ status: "valid", familyName: "우리 집" });
    acceptInvite.mockResolvedValue("test-family");
  });
  it("수락과 계정 갱신 중에는 스켈레톤을 유지하고 갱신 뒤 홈으로 이동해요", async () => {
    let finishAccept!: (familyId: string) => void;
    let finishAccount!: (account: Account) => void;
    acceptInvite.mockReturnValue(
      new Promise<string>((resolve) => {
        finishAccept = resolve;
      }),
    );
    fetchAccount.mockResolvedValueOnce(account).mockImplementationOnce(
      () =>
        new Promise<Account>((resolve) => {
          finishAccount = resolve;
        }),
    );
    const client = renderInvite();
    fireEvent.click(
      await screen.findByRole("button", { name: "초대 수락하고 합류하기" }),
    );
    expect(
      await screen.findByRole("status", { name: "합류하고 있어요" }),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => finishAccept("test-family"));
    await waitFor(() => expect(fetchAccount).toHaveBeenCalledTimes(2));
    expect(replace).not.toHaveBeenCalled();
    const joinedAccount: Account = {
      ...account,
      membership: { familyId: "test-family", role: "admin" },
    };
    replace.mockImplementation(() =>
      expect(client.getQueryData(["account"])).toEqual(joinedAccount),
    );
    await act(async () => finishAccount(joinedAccount));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(
      screen.getByRole("status", { name: "합류하고 있어요" }),
    ).toBeVisible();
    expect(
      screen.queryByText("이미 가정에 속해 있어 합류할 수 없어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "초대 수락하고 합류하기" }),
    ).not.toBeInTheDocument();
  });
  it("수락 실패는 오류와 재시도 버튼을 보여 주고 이동하지 않아요", async () => {
    acceptInvite.mockRejectedValue(
      new ApiError("network_error", "다시 시도해 주세요"),
    );
    renderInvite();
    fireEvent.click(
      await screen.findByRole("button", { name: "초대 수락하고 합류하기" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "다시 시도해 주세요",
    );
    expect(
      screen.getByRole("button", { name: "초대 수락하고 합류하기" }),
    ).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
  it.each([
    ["used", "이미 사용된 초대 링크예요"],
    ["expired", "만료된 초대 링크예요"],
    ["not_found", "초대 링크를 찾을 수 없어요"],
  ])("%s 링크는 해당 안내만 보여 줘요", async (status, message) => {
    fetchInvite.mockResolvedValue({ status });
    renderInvite();
    expect(await screen.findByText(new RegExp(message))).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "초대 수락하고 합류하기" }),
    ).not.toBeInTheDocument();
    expect(acceptInvite).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
