import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "./list-skeleton";
import { SkeletonStatus } from "./skeleton";

describe("P11.4 섹션 목록 로딩", () => {
  it("행 대신 하나의 카드 블록과 공용 안내를 보여 줘요", () => {
    const { container } = render(
      <SkeletonStatus>
        <ListSkeleton />
      </SkeletonStatus>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(
      screen.getByRole("group", { name: "목록을 불러오고 있어요" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "화면을 불러오고 있어요",
    );
  });

  it("전달한 로딩 이름을 사용해요", () => {
    render(<ListSkeleton label="항목을 불러와요" />);
    expect(
      screen.getByRole("group", { name: "항목을 불러와요" }),
    ).toBeVisible();
  });
});
