import { cva } from "class-variance-authority";

export const todoListRowStyles = {
  row: "min-h-[var(--hit)] py-0",
  checkbox: "z-10",
  titleButton: [
    "static! max-w-full justify-start text-left text-body font-normal",
    "before:absolute before:inset-0 before:content-[''] after:hidden",
  ].join(" "),
  privacyIcon: "shrink-0 text-[var(--icon-tertiary)]",
  overdue: "whitespace-nowrap text-muted-foreground",
  title: cva("truncate", {
    variants: { completed: { true: "line-through" } },
  }),
};
