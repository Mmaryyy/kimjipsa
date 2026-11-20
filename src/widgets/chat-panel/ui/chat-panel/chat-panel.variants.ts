import { cva } from "class-variance-authority";

export const chatHeaderButtonStyles = cva("bg-transparent text-primary");
export const chatAnswerChoiceStyles = cva([
  "rounded-full border border-[var(--separator)] bg-transparent py-1 text-foreground",
  "aria-pressed:border-primary aria-pressed:bg-accent-soft aria-pressed:text-primary disabled:opacity-40",
]);
export const chatProposalChoiceStyles = cva([
  "rounded-full bg-muted text-caption text-foreground",
  "aria-pressed:bg-accent-soft aria-pressed:text-primary",
]);
export const chatReceiptSelectStyles = cva(
  "bg-muted py-2 pl-2 text-body-sm leading-[1.4]",
);
export const chatFaqButtonStyles = cva(
  "min-h-8 justify-start p-0 text-left text-body-sm font-normal text-[var(--link)]",
);
