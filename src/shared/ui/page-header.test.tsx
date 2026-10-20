import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("CAL-07 페이지 제목 크기", () => {
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
