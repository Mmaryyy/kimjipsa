import { cva } from "class-variance-authority";

export const onboardingStyles = cva("flex flex-1 flex-col", {
  variants: {
    part: {
      page: [
        "mx-auto min-h-dvh max-w-110 pt-[max(var(--sp-3),env(safe-area-inset-top))]",
        "pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))]",
      ],
      panel: "gap-8 pt-10 [&>:last-child]:mt-auto",
      form: "gap-5 [&>button[type=submit]]:mt-auto",
    },
  },
});

export const wordmarkStyles = cva([
  "text-[length:var(--sp-10)] leading-[var(--wordmark-line-height)] font-bold",
  "tracking-[calc(var(--type-display-tracking)*2)]",
]);
