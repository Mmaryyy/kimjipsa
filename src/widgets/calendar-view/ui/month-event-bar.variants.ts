import { cva } from "class-variance-authority";

export const monthEventBarStyles = cva(
  "absolute inset-x-0 h-[var(--calendar-bar-height)] opacity-50",
  {
    variants: {
      start: { true: "rounded-l-[var(--r-bar)]", false: "" },
      end: { true: "rounded-r-[var(--r-bar)]", false: "" },
      // 첫 줄을 색점 바로 아래에 둬서 막대가 한 줄일 때도 색점과의 간격이 같게 보인다.
      lane: {
        0: "top-0",
        1: "top-[calc(var(--calendar-bar-height)+var(--calendar-mark-gap))]",
      },
    },
  },
);
