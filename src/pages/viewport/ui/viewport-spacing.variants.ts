import { cva } from "class-variance-authority";

export const spacingButtonStyles = cva([
  "bg-muted px-1 text-foreground tabular-nums",
  "aria-pressed:bg-primary aria-pressed:text-primary-foreground",
]);
