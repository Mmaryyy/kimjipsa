import { cva } from "class-variance-authority";
import { compactFieldStyles } from "../ui.variants";

export const dateTimeTriggerStyles = cva(
  "min-w-0 max-w-full text-primary [@media(pointer:coarse)]:focus-visible:outline-none",
  {
    variants: {
      variant: {
        inline: "min-h-[var(--ctl-h)] text-right",
        field:
          "block w-full rounded-sm bg-muted px-3 text-start focus-visible:-outline-offset-2",
      },
      size: { default: "", compact: compactFieldStyles },
      clearable: { true: "pe-11" },
    },
    compoundVariants: [
      { variant: "field", size: "default", class: "min-h-11" },
    ],
    defaultVariants: { variant: "inline", size: "default" },
  },
);
