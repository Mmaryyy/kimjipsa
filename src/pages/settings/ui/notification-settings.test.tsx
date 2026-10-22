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
const { save, mutation, enablePush, checkPush } = vi.hoisted(() => ({
  save: vi.fn(),
  enablePush: vi.fn(),
  checkPush: vi.fn(),
  mutation: { isPending: false },
}));
vi.mock("../api/web-push", () => ({
  hasWebPushSubscription: checkPush,
  enableWebPush: enablePush,
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
    checkPush.mockReset();
    checkPush.mockResolvedValue(true);
    enablePush.mockReset();
    enablePush.mockResolvedValue(undefined);
    save.mockReset();
    save.mockResolvedValue(null);
    mutation.isPending = false;
  });
  it("시각을 바꾸지 않고 닫거나 저장된 시각으로 돌리면 요청하지 않아요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("아침 요약");
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "08:30" } });
    fireEvent.change(input, { target: { value: "10:00" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.queryByText("알림 설정을 저장했어요"),
    ).not.toBeInTheDocument();
  });
  it("같은 시각의 중복 저장은 앞선 요청 성공 뒤 건너뛰어요", async () => {
    let finish!: () => void;
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("아침 요약");
    fireEvent.change(input, { target: { value: "08:30" } });
    fireEvent.blur(input);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.blur(input);
    });
    await act(async () => finish());
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("스위치를 바꾸면 즉시 저장하고 켜짐·꺼짐 안내를 보여 줘요", async () => {
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "웹 푸시 알림" });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
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
    expect(enablePush).not.toHaveBeenCalled();
  });
  it("기기 권한 거부는 계정 설정을 바꾸지 않고 안내한다", async () => {
    checkPush.mockResolvedValueOnce(false);
    enablePush.mockRejectedValueOnce(
      new Error("브라우저 설정에서 알림을 허용해 주세요."),
    );
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "이 기기에서 받기" }),
    );
    await screen.findByText("브라우저 설정에서 알림을 허용해 주세요.");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(save).not.toHaveBeenCalled();
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
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
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
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
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
  it("구독 확인 실패 중에도 계정 푸시를 끌 수 있다", async () => {
    checkPush.mockRejectedValueOnce(new Error("구독 확인 실패"));
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    await screen.findByText("구독 확인 실패");
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        pushEnabled: false,
        morningSummaryTime: "10:00",
      }),
    );
  });
  it("이 기기에 구독이 없어도 계정 값을 표시하고 기기 연결을 안내한다", async () => {
    checkPush.mockResolvedValueOnce(false);
    render(
      <ToastProvider>
        <NotificationSettings />
      </ToastProvider>,
    );
    const connect = await screen.findByRole("button", {
      name: "이 기기에서 받기",
    });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(connect);
    await waitFor(() => expect(enablePush).toHaveBeenCalledOnce());
    expect(save).not.toHaveBeenCalled();
  });
});
