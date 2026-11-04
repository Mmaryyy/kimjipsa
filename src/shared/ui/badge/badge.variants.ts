import { cva } from "class-variance-authority";

export const badgeStyles = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption-xs whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--fill-tertiary)] text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);
