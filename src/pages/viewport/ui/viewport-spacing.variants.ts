import { cva } from "class-variance-authority";

export const spacingButtonStyles = cva("min-h-[var(--hit)] px-1 tabular-nums", {
  variants: {
    selected: {
      true: "bg-primary text-primary-foreground",
      false: "",
    },
  },
});
