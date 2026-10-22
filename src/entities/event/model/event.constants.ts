import type { categoryColors } from "@/shared/ui";
export const eventPollingIntervalMs = 30_000;
export const eventVisibility = {
  shared: "공유",
  private: "개인 일정",
} as const;
export const eventCategoryColors = {
  teal: "청록",
  blue: "파랑",
  green: "초록",
  purple: "보라",
  pink: "분홍",
  brown: "갈색",
} as const satisfies Record<keyof typeof categoryColors, string>;
