import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import AccountSettingsSkeleton from "./Skeleton";

describe("ACC-12 P4.12 계정 설정 스켈레톤", () => {
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
});
