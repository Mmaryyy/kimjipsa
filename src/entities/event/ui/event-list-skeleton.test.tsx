import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventListSkeleton } from "./event-list-skeleton";

describe("CAL-07 CAL-13 P4.12 섹션 스켈레톤", () => {
  it("SCN-CAL-8 일정 제목과 하나의 카드를 보여 줘요", () => {
    const { container } = render(<EventListSkeleton title="다가오는 일정" />);
    expect(
      screen.getByRole("group", { name: "다가오는 일정을 불러오고 있어요" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("heading", { name: "다가오는 일정", level: 2 }),
    ).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
  });
  it("SCN-CAL-9 D-day 카드를 보여 줘요", () => {
    const { container } = render(<EventListSkeleton title="D-day" dday />);
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "D-day를 불러오고 있어요",
    );
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
});
