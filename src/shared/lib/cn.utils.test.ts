import { describe, expect, it } from "vitest";
import { cn } from "./cn.utils";

describe("CAL-17 r065-f1 전용 글자 크기 병합", () => {
  it("공휴일 글자 크기와 색을 함께 유지해요", () => {
    expect(cn("text-caption-xs text-[var(--sys-red-ic)]")).toBe(
      "text-caption-xs text-[var(--sys-red-ic)]",
    );
  });

  it("같은 범위의 글자 크기는 마지막 값만 남겨요", () => {
    expect(cn("text-caption text-caption-xs")).toBe("text-caption-xs");
  });

  it("반응형 글자 크기와 조건부 색을 함께 유지해요", () => {
    expect(
      cn("text-caption-xs sm:text-caption-sm", {
        "text-[var(--sys-red-ic)]": true,
      }),
    ).toBe("text-caption-xs sm:text-caption-sm text-[var(--sys-red-ic)]");
  });
});
