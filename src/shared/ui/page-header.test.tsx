import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageHeader from "./page-header";

describe("CAL-07 페이지 제목 크기", () => {
  it.each([1, 2, 3] as const)(
    "h%s 제목은 동작 버튼 옆에서 줄어들어요",
    (level) => {
      render(
        <PageHeader
          title="긴 페이지 제목"
          headingLevel={level}
          actions={<button>설정</button>}
        />,
      );
      expect(screen.getByRole("heading", { level })).toHaveClass(
        "min-w-0",
        "flex-1",
      );
    },
  );
  it.each(["오늘", "2026년 10월", "설정", "카테고리 관리", "재고", "장바구니"])(
    "%s 제목은 title-lg를 사용해요",
    (title) => {
      render(<PageHeader title={title} />);
      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toHaveClass("text-title-lg");
    },
  );
});
