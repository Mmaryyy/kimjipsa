import { cva } from "class-variance-authority";

export const calendarNumberStyles = cva(
  [
    "grid size-8 place-items-center rounded-[var(--r-round)]",
    "text-[length:var(--type-body-size)] tabular-nums",
    "group-focus-visible/calendar-date:outline-2",
    "group-focus-visible/calendar-date:outline-[var(--accent)]",
    "group-focus-visible/calendar-date:outline-offset-2",
  ],
  {
    variants: {
      tone: {
        default: "font-medium",
        selected: "bg-foreground text-background font-semibold",
        today: "text-[var(--accent-text)] font-bold",
        outside: "text-[var(--label-tertiary)] font-medium",
        sunday: "text-[var(--sys-red-ic)] font-medium",
      },
    },
  },
);
