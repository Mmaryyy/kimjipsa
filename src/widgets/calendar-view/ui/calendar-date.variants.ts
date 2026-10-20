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
        saturday: "text-[var(--accent-text)]",
        outside: "text-[var(--label-tertiary)]",
        sunday: "text-[var(--sys-red-ic)]",
      },
      today: {
        true: "font-bold border-[1.5px] border-dashed border-current",
        false: "",
      },
      selected: {
        true: "bg-[var(--fill-secondary)]",
        false: "",
      },
    },
    compoundVariants: [
      { selected: true, today: false, className: "font-semibold" },
      {
        selected: false,
        today: false,
        className: "font-medium",
      },
    ],
    defaultVariants: { selected: false, today: false, tone: "default" },
  },
);
