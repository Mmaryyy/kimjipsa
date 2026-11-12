import { ConfirmTestProvider as ConfirmProvider } from "@/shared/ui/confirm-test-provider";
import type { ReactElement } from "react";
import {
  fireEvent,
  render as renderWithoutConfirm,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WithdrawAccount from ".";

const render = (ui: ReactElement) =>
  renderWithoutConfirm(ui, { wrapper: ConfirmProvider });

const state = vi.hoisted(() => ({
  onWithdraw: vi.fn(),
  reset: vi.fn(),
  pending: false,
  error: null as Error | null,
}));
vi.mock("../../model/use-withdraw-account", () => ({
  useWithdrawAccount: () => state,
}));

describe("ACC-15 SCN-ACC-6 탈퇴 확인", () => {
  beforeEach(() => {
    state.onWithdraw.mockReset();
    state.reset.mockReset();
    state.pending = false;
    state.error = null;
  });

  it("삭제 범위와 가정 데이터 유지 조건을 보여 주고 취소하면 탈퇴하지 않아요", () => {
    render(<WithdrawAccount />);
    fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "내 계정과 개인 일정",
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "공유 일정, 재고, 장바구니는 가정에 남아요",
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "마지막 구성원이 탈퇴하면 가정 데이터도 모두 삭제돼요",
    );
    fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    expect(state.onWithdraw).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("확인한 뒤에만 탈퇴하고 처리 중에는 재요청과 닫기를 막아요", () => {
    const view = render(<WithdrawAccount />);
    fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "탈퇴하기",
      }),
    );
    expect(state.onWithdraw).toHaveBeenCalledOnce();
    state.pending = true;
    view.rerender(<WithdrawAccount />);
    expect(
      screen.getByRole("button", { name: "처리하고 있어요" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소하기" })).toBeDisabled();
  });

  it("실패 이유를 확인창에 보여 주고 다시 시도할 수 있어요", async () => {
    state.onWithdraw.mockRejectedValueOnce(
      new Error("연결을 확인하고 다시 시도해 주세요."),
    );
    render(<WithdrawAccount />);
    fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "탈퇴하기",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "연결을 확인하고 다시 시도해 주세요.",
      ),
    );
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "탈퇴하기",
      }),
    ).toBeEnabled();
  });
});

it("ACC-15 SCN-ACC-6 확인창을 다시 열 때 이전 오류를 초기화해요", () => {
  render(<WithdrawAccount />);
  fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
  fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
  fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
  expect(state.reset).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "내가 만든 안 쓴 초대 링크",
  );
  expect(screen.getAllByRole("list")).toHaveLength(2);
});
