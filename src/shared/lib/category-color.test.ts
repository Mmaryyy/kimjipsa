// @vitest-environment node
/* eslint-disable tokens/no-color-literals -- 색 계산·저장 형식의 입력과 기댓값을 검증해요. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categoryColors, categoryColorHex } from "./category-color.constants";
import {
  readableTextColor,
  resolveCategoryColor,
} from "./category-color.utils";
import { categoryColorSchema } from "./category-color.schema";

const tokens = readFileSync("src/app/styles/tokens.css", "utf8");

describe("CAL-08 카테고리 색과 자동 글자색", () => {
  it("프리셋 6색은 전용 토큰을 쓰고 색이 없으면 회색이에요", () => {
    expect(Object.keys(categoryColors)).toHaveLength(6);
    for (const color of Object.values(categoryColors))
      expect(color).toMatch(/^var\(--cat-/);
    expect(resolveCategoryColor()).toBe("var(--cat-gray)");
  });
  it.each(Object.keys(categoryColors) as (keyof typeof categoryColors)[])(
    "프리셋 %s는 CSS 원본의 색을 계산해요",
    (key) => {
      const hex = tokens.match(
        new RegExp(`--cat-${key}:\\s*(#[0-9a-f]{6})`),
      )![1];
      expect(categoryColorHex[key]).toBe(hex);
      expect(resolveCategoryColor(key)).toBe(`var(--cat-${key})`);
      expect(readableTextColor(key)).toBe("#000000");
      expect(readableTextColor(key)).toBe(
        readableTextColor(hex as `#${string}`),
      );
      expect(categoryColorSchema.parse(key)).toBe(key);
    },
  );
  it.each([
    ["#000", "#ffffff"],
    ["#fff", "#000000"],
    ["#000000", "#ffffff"],
    ["#ffffff", "#000000"],
    ["#757575", "#ffffff"],
    ["#767676", "#000000"],
    ["#ff0000", "#000000"],
  ] as const)("%s의 대비가 큰 글자색은 %s예요", (color, expected) => {
    expect(readableTextColor(color)).toBe(expected);
  });
  it.each(["red", "teal", "#12345", "#1234567", "#gggggg", "#ABCDEF", "#fff"])(
    "저장할 수 없는 값 %s를 거부해요",
    (color) => {
      expect(categoryColorSchema.safeParse(color).success).toBe(false);
    },
  );
  it("빨강 계열의 직접 선택도 저장해요", () => {
    expect(categoryColorSchema.parse("#ff0000")).toBe("#ff0000");
  });
});
