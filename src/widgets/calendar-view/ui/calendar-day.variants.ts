import { cva } from "class-variance-authority";
export const calendarDayStyles = cva("w-full", {
  variants: {
    selected: {
      true: "bg-primary text-primary-foreground",
      false: "bg-muted text-foreground",
    },
  },
});

export const calendarEventMarkerStyles = cva(
  "flex min-w-0 items-center gap-1 text-caption-sm text-muted-foreground",
  {
    variants: { masked: { true: "opacity-50", false: "" } },
  },
);
