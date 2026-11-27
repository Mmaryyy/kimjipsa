import { cva } from "class-variance-authority";

export const milestoneDotStyles = cva(
  "absolute top-[var(--dot-y,1.25rem)] -translate-y-1/2 rounded-full border-2",
  {
    variants: {
      empty: {
        true: "size-2 border-muted-foreground bg-background",
        false: "size-2.5 border-muted-foreground bg-muted-foreground",
      },
      current: { true: "" },
    },
    compoundVariants: [
      {
        empty: [true, false],
        current: true,
        class: "size-3 border-primary bg-primary",
      },
    ],
  },
);

export const milestoneCardStyles = cva("min-w-0 px-3", {
  variants: {
    empty: {
      true: "",
      false: "space-y-1 rounded-control border border-border py-2.5",
    },
    current: { true: "" },
  },
  compoundVariants: [
    {
      empty: false,
      current: true,
      class: "border-primary/30 bg-fill-tertiary",
    },
  ],
});
