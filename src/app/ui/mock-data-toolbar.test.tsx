import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Config from "@/shared/config";
import { MockDataToolbar } from "./mock-data-toolbar";

vi.mock("@/features/account", () => ({
  useAccount: () => ({ data: { profile: { displayName: "지수" } } }),
}));
vi.mock("@/shared/config", async (original) => ({
  ...(await original<typeof Config>()),
  isMockDataEnabled: () => true,
}));
afterEach(cleanup);

async function clickOutsidePanel() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
  fireEvent.click(document.body, { button: 0 });
}

describe("P4.6 개발용 목업 도구", () => {
  it("아이콘으로 열면 시점 전환과 목업 스위치를 보여 주고 Esc로 닫아요", async () => {
    render(<MockDataToolbar />);
    const trigger = screen.getByRole("button", {
      name: "개발용 테스트 데이터 열기",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const panel = screen.getByRole("dialog", { name: "개발용 테스트 데이터" });
    expect(screen.getByRole("switch", { name: "목업 모드" })).toBeChecked();
    for (const name of [
      "나 · 지수",
      "배우자 · 민호",
      "로그인 화면",
      "가입 · 약관",
      "가입 · 가정",
    ])
      expect(screen.getByRole("button", { name })).toBeVisible();
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("패널 바깥을 누르면 닫아요", async () => {
    render(<MockDataToolbar />);
    fireEvent.click(
      screen.getByRole("button", { name: "개발용 테스트 데이터 열기" }),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    // Radix는 바깥 포인터 리스너를 연결하고 클릭이 끝난 뒤 패널을 닫아요.
    await clickOutsidePanel();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("패널 안을 누르면 열린 상태를 유지해요", () => {
    render(<MockDataToolbar />);
    fireEvent.click(
      screen.getByRole("button", { name: "개발용 테스트 데이터 열기" }),
    );
    const panel = screen.getByRole("dialog", { name: "개발용 테스트 데이터" });
    const description = screen.getByText(
      "목업 모드와 시점을 바꿔 화면을 확인해요.",
    );
    fireEvent.pointerDown(description, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(description, { pointerType: "mouse", button: 0 });
    fireEvent.click(description, { button: 0 });
    expect(panel).toBeVisible();
  });
});
