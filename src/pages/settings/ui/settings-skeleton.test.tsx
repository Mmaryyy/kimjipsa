import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountSettingsSkeleton, SettingsSkeleton } from "./settings-skeleton";

describe("ACC-12 P4.12 설정 섹션 스켈레톤", () => {
  it("내 정보와 구성원 구역을 나누어 표시해요", () => {
    const { rerender } = render(<AccountSettingsSkeleton section="profile" />);
    expect(
      screen.getByRole("group", { name: "내 정보를 불러오고 있어요" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "가정과 구성원을 불러오고 있어요" }),
    ).not.toBeInTheDocument();
    rerender(<AccountSettingsSkeleton section="members" />);
    expect(
      screen.queryByRole("group", { name: "내 정보를 불러오고 있어요" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "가정과 구성원을 불러오고 있어요" }),
    ).toBeVisible();
  });
  it("설정 구역의 로딩을 안내해요", () => {
    render(<SettingsSkeleton label="홈 설정을 불러오고 있어요" rows={3} />);
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
  });
});
