import { cva } from "class-variance-authority";

export const pageHeaderSubtitleStyles = cva("", {
  variants: {
    variant: {
      default: "mt-1 text-muted-foreground",
      context: "mt-0.5 font-semibold text-foreground",
      "context-muted": "mt-0.5 text-muted-foreground",
    },
  },
});
