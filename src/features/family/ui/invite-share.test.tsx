import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteShare } from "./invite-share";

const { onShare } = vi.hoisted(() => ({ onShare: vi.fn() }));
vi.mock("../model/use-family", () => ({
  useInviteShare: () => ({
    invitation: { token: "invite-token", expiresAt: "2026-10-22T00:00:00Z" },
    onCreate: vi.fn(),
    onShare,
    pending: false,
    error: null,
    shareMessage: "",
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ACC-05 SCN-ACC-1 초대 공유 수단", () => {
  it("공유 기능이 없으면 복사만 제공해요", () => {
    vi.stubGlobal("navigator", { share: undefined });
    render(<InviteShare onboarding />);
    expect(
      screen.queryByRole("button", { name: "카카오톡으로 보내기" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    expect(onShare).toHaveBeenCalledWith(true);
  });

  it("공유 기능이 있으면 공유와 복사를 각각 제공해요", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    render(<InviteShare onboarding />);
    fireEvent.click(
      screen.getByRole("button", { name: "카카오톡으로 보내기" }),
    );
    expect(onShare).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: "복사" })).toBeVisible();
  });
});
