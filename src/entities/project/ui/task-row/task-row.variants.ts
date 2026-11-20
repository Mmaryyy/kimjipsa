import { cva } from "class-variance-authority";

export const taskRowStyles = cva(
  [
    "relative grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[24px_20px]",
    "items-center gap-x-3 py-2",
    "after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0",
    "after:border-b after:border-border/60 last:after:hidden",
  ],
  {
    variants: {
      status: {
        open: "[&_[data-slot=task-description]]:text-muted-foreground",
        done: [
          "[&_[data-slot=task-title]]:text-label-done",
          "[&_[data-slot=task-title]]:line-through",
          "[&_[data-slot=task-title]]:decoration-label-done",
          "[&_[data-slot=task-description]]:text-label-done",
        ],
      },
    },
  },
);

export const taskRowTitleStyles = cva([
  "col-span-2 col-start-2 row-span-2 row-start-1 grid min-w-0",
  "grid-cols-subgrid grid-rows-subgrid justify-normal gap-x-3 gap-y-0 text-start",
]);
