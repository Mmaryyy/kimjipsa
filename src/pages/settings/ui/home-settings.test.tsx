import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as UserModule from "@/entities/user";
import { HomeSettings } from "./home-settings";
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
  it("뷰·위젯 표시·개수를 사용자 설정으로 저장해요", async () => {
    render(<HomeSettings />);
    fireEvent.change(screen.getByLabelText("달력 보기"), {
      target: { value: "month" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "다가오는 일정" }));
    fireEvent.change(screen.getByLabelText("일정 개수"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "홈 구성 저장하기" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        homeView: "month",
        upcomingEnabled: false,
        upcomingCount: 10,
      }),
    );
  });
  it("저장에 실패하면 오류를 알리고 다시 저장할 수 있어요", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("저장 실패"));
    render(<HomeSettings />);
    fireEvent.change(screen.getByLabelText("일정 개수"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "홈 구성 저장하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");
    expect(
      screen.getByRole("button", { name: "홈 구성 저장하기" }),
    ).toBeEnabled();
  });
  it("설정 조회 중에는 로딩을 보여 줘요", () => {
    useHomeSettings.mockReturnValue({ isPending: true });
    render(<HomeSettings />);
    expect(
      screen.getByRole("status", { name: "홈 설정을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("설정 조회 실패 시 기본값으로 덮어쓰지 않고 재시도해요", () => {
    const refetch = vi.fn();
    useHomeSettings.mockReturnValue({
      isError: true,
      error: new Error("설정 조회 실패"),
      refetch,
    });
    render(<HomeSettings />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "홈 구성 저장하기" }),
    ).not.toBeInTheDocument();
  });
});
