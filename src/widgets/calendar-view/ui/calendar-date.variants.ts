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
        default: "text-foreground",
        today: "text-[var(--accent-text)]",
        outside: "text-[var(--label-tertiary)]",
        sunday: "text-[var(--sys-red-ic)]",
      },
      selected: {
        true: "bg-[var(--fill-secondary)] font-semibold",
        false: "",
      },
    },
    compoundVariants: [
      { selected: false, tone: "today", className: "font-bold" },
      {
        selected: false,
        tone: ["default", "outside", "sunday"],
        className: "font-medium",
      },
    ],
    defaultVariants: { selected: false, tone: "default" },
  },
);
