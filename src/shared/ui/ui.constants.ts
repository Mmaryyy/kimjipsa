// 사용자 선택 색상이며, 도메인의 기본 카테고리 시드는 아니에요.
// 빨강(--sys-red 계열)은 일요일·공휴일 전용이므로 카테고리 색에 추가하지 않아요.
export const categoryColors = {
  teal: "var(--sys-teal)",
  blue: "var(--sys-blue)",
  green: "var(--sys-green)",
  purple: "var(--sys-purple)",
  pink: "var(--sys-pink)",
  brown: "var(--sys-brown)",
} as const;
