import { cva } from "class-variance-authority";

export const calendarNumberStyles = cva(
  [
    "grid size-8 place-items-center rounded-[var(--r-round)]",
    "text-[length:var(--type-body-size)] tabular-nums",
  ],
  {
    variants: {
      tone: {
        default: "",
        selected: "bg-foreground text-background",
        outside: "text-[var(--label-tertiary)]",
        sunday: "text-[var(--sys-red-ic)]",
      },
      today: { true: "font-bold", false: "font-medium" },
    },
  },
);
