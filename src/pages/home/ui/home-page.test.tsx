import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./home-page";

vi.mock("./home-schedule", () => ({ HomeSchedule: () => <h1>오늘</h1> }));

describe("CAL-13 홈 화면 조립", () => {
  it("일정 위젯이 제공하는 오늘 머리를 한 번만 보여 줘요", () => {
    render(<HomePage />);
    expect(
      screen.getAllByRole("heading", { name: "오늘", level: 1 }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: "컴포넌트 살펴보기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "우리 집·초대 관리하기" }),
    ).not.toBeInTheDocument();
  });
});
