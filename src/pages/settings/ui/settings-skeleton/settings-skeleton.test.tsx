import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import SettingsSkeleton from ".";

describe("ACC-12 P4.12 설정 섹션 스켈레톤", () => {
  it("설정 구역의 로딩을 안내해요", () => {
    render(<SettingsSkeleton label="홈 설정을 불러오고 있어요" rows={3} />);
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
  });
});
