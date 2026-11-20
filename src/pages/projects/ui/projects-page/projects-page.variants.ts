import { cva } from "class-variance-authority";

export const projectFilterTabsStyles = cva(
  "mt-4 [&_button[data-state=on]]:text-primary",
);
