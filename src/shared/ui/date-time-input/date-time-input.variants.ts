import { cva } from "class-variance-authority";

export const dateTimeTriggerStyles = cva(
  "min-w-0 max-w-full text-primary [@media(pointer:coarse)]:focus-visible:outline-none",
  {
    variants: {
      variant: {
        inline: "min-h-[var(--ctl-h)] text-right",
        field: "min-h-11 w-full rounded-sm bg-muted ps-3 pe-3 text-start",
      },
      clearable: { true: "pe-11" },
    },
    defaultVariants: { variant: "inline" },
  },
);
