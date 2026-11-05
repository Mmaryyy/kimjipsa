import { cva } from "class-variance-authority";

export const sheetStyles = cva(
  [
    "text-foreground surface-edge max-md:before:hidden",
    "md:rounded-[var(--r-dialog)] md:border md:border-[var(--glass-border)]",
  ],
  {
    variants: {
      presentation: {
        sheet: [
          "fixed bottom-0 left-0 z-81 max-h-[var(--sheet-mobile-max-height)]",
          "w-full overflow-x-hidden overflow-y-auto",
          "bg-background px-4 pt-0 pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))]",
          "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] animate-sheet-in md:top-1/2",
          "md:bottom-auto md:left-1/2 md:max-h-[var(--sheet-desktop-max-height)] md:w-130",
          "md:-translate-1/2 md:animate-[kj-dialog-in_var(--dur)_var(--ease)]",
          "motion-reduce:animate-none md:motion-reduce:animate-none",
        ],
        panel: [
          "fixed inset-x-0 top-0 z-81 outline-none",
          "flex h-dvh flex-col overflow-hidden bg-background",
          "md:inset-auto md:right-6 md:bottom-6 md:h-[min(680px,calc(100dvh-48px))] md:w-100",
          "md:animate-none md:shadow-[var(--shadow-sheet)]",
        ],
      },
    },
    defaultVariants: { presentation: "sheet" },
  },
);
