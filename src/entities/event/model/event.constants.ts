import type { categoryColors } from "@/shared/lib";
export const eventPollingIntervalMs = 30_000;
export const eventVisibility = {
  shared: "공유",
  private: "개인 일정",
} as const;
export const eventCategoryColors = {
  blue: "파랑",
  sky: "하늘",
  cream: "크림",
  sand: "모래",
  sage: "세이지",
  gray: "회색",
} as const satisfies Record<keyof typeof categoryColors, string>;
