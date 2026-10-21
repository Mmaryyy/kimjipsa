import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as UserEntity from "@/entities/user";
import { ToastProvider } from "@/shared/ui";
import { NotificationSettings } from "./notification-settings";
const { save, mutation } = vi.hoisted(() => ({
  save: vi.fn(),
  mutation: { isPending: false },
}));
vi.mock("@/entities/user", async (original) => ({
  ...(await original<typeof UserEntity>()),
  useNotificationSettings: () => ({
    data: { pushEnabled: true, morningSummaryTime: "10:00" },
    isPending: false,
    isError: false,
  }),
  useSaveNotificationSettings: () => ({
    mutateAsync: save,
    isPending: mutation.isPending,
  }),
}));
describe("ACC-11 SCN-ACC-5 알림 설정 저장", () => {
  beforeEach(() => {
    save.mockReset();
    save.mockResolvedValue(null);
    mutation.isPending = false;
  });
  it("스위치를 바꾸면 즉시 저장하고 켜짐·꺼짐 안내를 보여 줘요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "웹 푸시 알림" });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        pushEnabled: false,
        morningSummaryTime: "10:00",
      }),
    );
    expect(await screen.findByText("알림을 껐어요")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await screen.findByText("알림을 켰어요")).toBeInTheDocument();
  });
  it("시각은 blur에 저장하고 실패하면 직전 성공 값으로 복구해요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("아침 요약");
    fireEvent.change(input, { target: { value: "08:30" } });
    expect(save).not.toHaveBeenCalled();
    fireEvent.blur(input);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await screen.findByText("알림 설정을 저장했어요");
    save.mockRejectedValueOnce(new Error("저장 실패"));
    fireEvent.change(input, { target: { value: "09:45" } });
    fireEvent.blur(input);
    expect(await screen.findByText("저장 실패")).toBeInTheDocument();
    expect(input).toHaveValue("08:30");
  });
  it("스위치 저장 실패도 마지막 성공 값으로 되돌려요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    await screen.findByText("알림을 껐어요");
    save.mockRejectedValueOnce(new Error("저장 실패"));
    fireEvent.click(toggle);
    await screen.findByText("저장 실패");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
  it("잘못된 시각은 오류를 보여 주고 저장하지 않아요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("아침 요약");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(save).not.toHaveBeenCalled();
  });
  it("저장 중에도 입력과 포커스를 유지해요", async () => {
    let finish!: () => void;
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(save).toHaveBeenCalled());
    mutation.isPending = true;
    view.rerender(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("아침 요약");
    input.focus();
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
    await act(async () => finish());
  });
});
