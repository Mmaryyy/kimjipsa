import { cva } from "class-variance-authority";

export const messageRowStyles = cva("flex gap-2", {
  variants: { role: { user: "justify-end", assistant: "justify-start" } },
});
export const messageBubbleStyles = cva("min-w-0 rounded-control px-3 py-3", {
  variants: {
    role: {
      user: "bg-muted text-foreground",
      assistant: "bg-info-soft text-foreground",
    },
  },
});
