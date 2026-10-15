import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "./list-skeleton";

describe("P1 ListSkeleton (기능 SCN 연결 전)", () => {
  it("접근 가능한 로딩 상태와 이름을 제공해요", () => {
    render(<ListSkeleton />);
    expect(
      screen.getByRole("status", { name: "목록을 불러오고 있어요" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("전달한 로딩 이름을 사용해요", () => {
    render(<ListSkeleton label="항목을 불러와요" />);
    expect(
      screen.getByRole("status", { name: "항목을 불러와요" }),
    ).toBeVisible();
  });
});
