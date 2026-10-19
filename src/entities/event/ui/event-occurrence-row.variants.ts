import { cva } from "class-variance-authority";

export const ddayLabelStyles = cva(
  "block w-[4.5em] shrink-0 text-left whitespace-nowrap tabular-nums",
  {
    variants: {
      size: {
        title:
          "text-[length:var(--type-title-size)] leading-[var(--type-title-lh)]",
        caption:
          "text-[length:var(--type-caption-size)] leading-[var(--type-caption-lh)]",
      },
      tone: {
        today: "font-bold text-[color:var(--error-text)]",
        soon: "font-semibold text-[color:var(--info-text)]",
        distant: "font-normal text-foreground",
      },
    },
    defaultVariants: { size: "caption", tone: "distant" },
  },
);
