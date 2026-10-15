import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("P1 EmptyState (기능 SCN 연결 전)", () => {
  it("빈 상태 메시지와 전달한 행동을 보여 줘요", () => {
    render(
      <EmptyState
        message="목록이 비어 있어요"
        action={<button>추가하기</button>}
      />,
    );
    expect(screen.getByText("목록이 비어 있어요")).toBeVisible();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeVisible();
  });
});
