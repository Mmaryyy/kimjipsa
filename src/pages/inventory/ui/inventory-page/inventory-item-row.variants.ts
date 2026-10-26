import { cva } from "class-variance-authority";

export const inventoryStatusControlStyles = cva(
  "[&_button]:min-h-7 [&_button]:px-2 [&_button]:text-caption [&_button]:text-muted-foreground",
  {
    variants: {
      state: {
        enough: "[&_button[data-state=on]]:text-foreground",
        low: "[&_button[data-state=on]]:text-warning-text",
        none: "[&_button[data-state=on]]:text-error-text",
      },
    },
  },
);
