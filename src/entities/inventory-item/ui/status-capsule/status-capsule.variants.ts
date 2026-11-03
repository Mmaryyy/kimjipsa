import { cva } from "class-variance-authority";

export const inventoryStatusCapsuleStyles = cva(
  [
    "relative isolate inline-flex h-11 shrink-0 items-center rounded-full",
    "px-[var(--sp-half)] [-webkit-touch-callout:none] before:absolute",
    "before:inset-x-0 before:top-1/2 before:-z-10",
    "before:h-[calc(var(--ctl-h-sm)+var(--sp-half))] before:-translate-y-1/2",
    "before:rounded-full before:bg-[var(--capsule-soft)]",
  ],
  {
    variants: {
      status: {
        enough:
          "[--capsule-soft:var(--status-ok-soft)] [--capsule-text:var(--status-ok-text)]",
        low: "[--capsule-soft:var(--status-low-soft)] [--capsule-text:var(--status-low-text)]",
        none: "[--capsule-soft:var(--status-none-soft)] [--capsule-text:var(--status-none-text)]",
      },
      open: { true: "before:bg-[var(--fill-secondary)]" },
    },
  },
);
