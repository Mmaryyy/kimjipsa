import { cva } from "class-variance-authority";

export const taskAssigneeTabsStyles = [
  "mt-2 gap-2 py-0 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:text-left",
  "[&_button[data-state=off]]:text-muted-foreground",
].join(" ");

export const taskFilterStyles = cva(
  "min-h-11 [field-sizing:content] pr-4 text-caption font-semibold text-foreground",
);

export const taskWarningDot = "size-1.5 shrink-0 rounded-full bg-warning";

export const taskDeadlineStyles = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-0.5 text-caption tabular-nums",
  {
    variants: {
      tone: {
        late: "bg-sys-gray5 font-semibold text-foreground",
        today: "bg-[var(--accent-soft)] font-bold text-[var(--accent-text)]",
        soon: "bg-sys-gray5 font-semibold text-[var(--accent-text)]",
        later: "bg-sys-gray5 font-semibold text-foreground",
      },
    },
  },
);
