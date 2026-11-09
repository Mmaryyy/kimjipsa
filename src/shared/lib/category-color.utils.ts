import {
  categoryColors,
  categoryColorHex,
  type CategoryColor,
} from "./category-color.constants";

// eslint-disable-next-line tokens/no-color-literals -- 회색 CSS 값이 아닌 프리셋 키예요.
export function resolveCategoryColor(color: CategoryColor = "gray"): string {
  return color.startsWith("#")
    ? color
    : categoryColors[color as keyof typeof categoryColors];
}

// WCAG의 고정 비교색은 카테고리 팔레트가 아닌 계산 결과예요.
// eslint-disable-next-line tokens/no-color-literals
const [lightText, darkText] = ["#ffffff", "#000000"] as const;

export function readableTextColor(color: CategoryColor) {
  const hex = color.startsWith("#")
    ? color
    : categoryColorHex[color as keyof typeof categoryColorHex];
  const expanded = /^#[0-9a-f]{3}$/i.test(hex)
    ? "#" + [...hex.slice(1)].map((digit) => digit + digit).join("")
    : hex;
  if (!/^#[0-9a-f]{6}$/i.test(expanded))
    throw new Error("색 값을 확인해 주세요.");
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.05
    ? lightText
    : darkText;
}
