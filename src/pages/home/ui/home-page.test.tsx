import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

describe("p0-5 초기 화면 (기능 SCN 연결 전)", () => {
  it("김집사 제목이 있는 빈 화면을 보여 줘요", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "김집사", level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
