import { cva } from "class-variance-authority";

export const dateTimeTabStyles = cva(
  "grid min-w-0 gap-1 text-left py-3 [@media(pointer:coarse)]:focus-visible:outline-none",
  {
    variants: {
      selected: { true: "text-primary", false: "text-muted-foreground" },
    },
  },
);
