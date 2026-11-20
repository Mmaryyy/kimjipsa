import { cva } from "class-variance-authority";

export const milestoneDotStyles = cva(
  "absolute top-5 size-2.5 -translate-y-1/2 rounded-full border-2",
  {
    variants: {
      status: {
        past: "border-muted-foreground bg-muted-foreground",
        current: "size-3 border-primary bg-primary",
        upcoming: "border-muted-foreground bg-background",
        tentative: "border-dashed border-muted-foreground bg-background",
      },
    },
  },
);

export const milestoneCardStyles = cva(
  "min-w-0 space-y-1 rounded-sm border border-border/60 px-3 py-2.5",
  {
    variants: {
      status: {
        current: "border-primary/30 bg-fill-tertiary",
        past: "",
        upcoming: "",
        tentative: "",
      },
    },
  },
);
