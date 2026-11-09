export const categoryColors = {
  blue: "var(--cat-blue)",
  sky: "var(--cat-sky)",
  cream: "var(--cat-cream)",
  sand: "var(--cat-sand)",
  sage: "var(--cat-sage)",
  gray: "var(--cat-gray)",
} as const;

export type CategoryColor = keyof typeof categoryColors | `#${string}`;

/* eslint-disable tokens/no-color-literals -- 서버 색 계산용 고정 팔레트이며 CSS 원본과 일치하는지 테스트해요. */
export const categoryColorHex = {
  blue: "#81a6c6",
  sky: "#aacddc",
  cream: "#f3e3d0",
  sand: "#d2c4b4",
  sage: "#a9c1a1",
  gray: "#b7b9bc",
} as const satisfies Record<keyof typeof categoryColors, string>;

/* eslint-enable tokens/no-color-literals */
