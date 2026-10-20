import { describe, expect, it } from "vitest";
import { categoryColors } from "./ui.constants";

describe("CAL-17 공휴일 전용 색", () => {
  it("카테고리 색에는 --sys-red 계열을 쓰지 않아요", () => {
    for (const color of Object.values(categoryColors)) {
      expect(color).not.toMatch(/--sys-red/i);
    }
  });
});
