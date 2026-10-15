import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { catalogPath } from "@/shared/config";
import { HomePage } from "./home-page";

describe("P1 홈 화면 (기능 SCN 연결 전)", () => {
  it("페이지가 오늘 제목을 보여 줘요", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "오늘", level: 1 }),
    ).toBeVisible();
  });

  it("개발 모드에서 카탈로그 링크를 보여 줘요", () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      render(<HomePage />);
      expect(
        screen.getByRole("link", { name: "컴포넌트 살펴보기" }),
      ).toHaveAttribute("href", catalogPath);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
