export const spacingValues = [0, 8, 12, 16, 20, 24, 32, 48, 72] as const;
export const defaultSpacing = 20;
export const spacingStorageKey = "kimjipsa-viewport-spacing";

const scheduleTitles = [
  "함께 아침 먹기",
  "장보기",
  "산책하기",
  "저녁 준비하기",
];

export const spacingSchedule = Array.from({ length: 36 }, (_, index) => ({
  id: index + 1,
  time: `${String(8 + (index % 12)).padStart(2, "0")}:00`,
  title: scheduleTitles[index % scheduleTitles.length],
}));
