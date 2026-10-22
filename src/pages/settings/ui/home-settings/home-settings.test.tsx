import type * as UserModule from "@/entities/user";

import { SkeletonStatus, ToastProvider } from "@/shared/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomeSettings from "./";
const { useHomeSettings, mutateAsync } = vi.hoisted(() => ({
  useHomeSettings: vi.fn(),
  mutateAsync: vi.fn(),
}));
vi.mock("@/entities/user", async (original) => ({
  ...(await original<typeof UserModule>()),
  useHomeSettings,
  useSaveHomeSettings: () => ({ mutateAsync, isSuccess: false }),
}));
describe("ACC-12 홈 구성 저장", () => {
  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue(null);
    useHomeSettings.mockReturnValue({
      isPending: false,
      isError: false,
      data: { homeView: "week", upcomingEnabled: true, upcomingCount: 5 },
    });
  });
  it("선택된 보기와 표시 개수를 다시 고르면 저장하지 않아요", async () => {
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "주" }));
      fireEvent.click(screen.getByRole("radio", { name: "5개" }));
    });
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "월" }));
    await screen.findByText("홈 구성을 저장했어요");
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "월" }));
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
  it("저장 중 같은 값을 다시 선택해도 중복 요청하지 않아요", async () => {
    let finish!: () => void;
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    const month = screen.getByRole("radio", { name: "월" });
    fireEvent.click(month);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.click(month);
    });
    await act(async () => finish());
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
  it("뷰·위젯 표시·개수를 사용자 설정으로 저장해요", async () => {
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "월" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "10개" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("radio", { name: "10개" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
    fireEvent.click(screen.getByRole("switch", { name: "다가오는 일정" }));
    expect(
      screen.queryByRole("radio", { name: "10개" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        homeView: "month",
        upcomingEnabled: false,
        upcomingCount: 10,
      }),
    );
  });
  it("저장 중에도 포커스를 유지하고 최신 변경을 이어 저장해요", async () => {
    let finishSave: () => void = () => {};
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    const month = screen.getByRole("radio", { name: "월" });
    month.focus();
    fireEvent.click(month);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(month).toHaveFocus();
    expect(month).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: "10개" }));
    fireEvent.click(screen.getByRole("switch", { name: "다가오는 일정" }));
    await act(async () => {});
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    await act(async () => finishSave());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenLastCalledWith({
      homeView: "month",
      upcomingEnabled: false,
      upcomingCount: 10,
    });
    expect(screen.getByRole("switch")).not.toBeChecked();
  });
  it("저장에 실패하면 오류를 알리고 다시 저장할 수 있어요", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("저장 실패"));
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "3개" }));
    expect(await screen.findByText("저장 실패")).toBeVisible();
    expect(screen.getByRole("radio", { name: "5개" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "3개" })).toBeEnabled();
  });
  it("설정 조회 중에는 로딩을 보여 줘요", () => {
    useHomeSettings.mockReturnValue({ isPending: true });
    render(
      <ToastProvider>
        <SkeletonStatus>
          <HomeSettings />
        </SkeletonStatus>
      </ToastProvider>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "화면을 불러오고 있어요",
    );
    expect(
      screen.getByRole("group", { name: "홈 설정을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("설정 조회 실패 시 기본값으로 덮어쓰지 않고 재시도해요", () => {
    const refetch = vi.fn();
    useHomeSettings.mockReturnValue({
      isError: true,
      error: new Error("설정 조회 실패"),
      refetch,
    });
    render(
      <ToastProvider>
        <HomeSettings />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "홈 구성 저장하기" }),
    ).not.toBeInTheDocument();
  });
});
