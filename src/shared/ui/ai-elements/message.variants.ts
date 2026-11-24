import { cva } from "class-variance-authority";

export const messageStyles = cva("group flex w-full", {
  variants: {
    variant: {
      default: "max-w-[95%] flex-col gap-2",
      callout: "items-start gap-1.5",
    },
  },
  defaultVariants: { variant: "default" },
});

export const messageContentStyles = cva(
  "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden",
  {
    variants: {
      variant: {
        default: [
          "text-body-sm leading-[1.55]",
          "group-[.is-user]:ml-auto group-[.is-user]:max-w-[80%] group-[.is-user]:rounded-[calc(var(--r-control)*5)]",
          "group-[.is-user]:bg-accent-soft group-[.is-user]:px-4 group-[.is-user]:py-3",
          "group-[.is-user]:text-foreground",
          "group-[.is-assistant]:text-foreground",
        ],
        callout: [
          "rounded-[calc(var(--r-control)*2)] rounded-ss-sm px-2 py-1",
          "bg-(image:--ai-gradient-soft)",
          "text-caption-sm text-foreground [overflow-wrap:anywhere]",
        ],
      },
    },
    defaultVariants: { variant: "default" },
  },
);
