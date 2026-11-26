import { cva } from "class-variance-authority";

export const projectFilterTabsStyles = cva(
  "py-1.5 [&_button]:text-muted-foreground",
);

export const projectDeadlineStyles = cva(
  [
    "shrink-0 rounded-control bg-sys-gray5 px-2 py-half",
    "leading-[var(--type-caption-lh)] whitespace-nowrap tabular-nums",
  ],
  {
    variants: {
      tone: {
        today:
          "bg-[var(--accent-soft)] font-bold text-[color:var(--accent-text)]",
        soon: "font-semibold text-[color:var(--accent-text)]",
        later: "font-semibold",
      },
    },
  },
);
