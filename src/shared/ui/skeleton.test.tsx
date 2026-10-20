import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton, SkeletonSection, SkeletonStatus } from "./skeleton";

describe("ACC-12 CAL-07 P4.12 로딩 안내", () => {
  it("SCN-CAL-10 여러 구역이 로딩해도 안내는 하나이고 제목은 탐색할 수 있어요", () => {
    const { rerender } = render(
      <SkeletonStatus>
        <SkeletonSection label="일정 로딩">
          <h2>오늘 일정</h2>
          <Skeleton />
        </SkeletonSection>
        <SkeletonSection label="설정 로딩">
          <h2>홈 설정</h2>
          <Skeleton />
        </SkeletonSection>
      </SkeletonStatus>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "화면을 불러오고 있어요",
    );
    expect(screen.getByRole("heading", { name: "오늘 일정" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "홈 설정" })).toBeVisible();
    rerender(
      <SkeletonStatus>
        <p>완료</p>
      </SkeletonStatus>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
