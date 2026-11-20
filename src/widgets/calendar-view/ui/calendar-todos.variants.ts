import { cva } from "class-variance-authority";

export const calendarTodoStyles = cva("flex min-w-0", {
  variants: {
    compact: {
      true: "h-4 w-full items-center gap-0.5",
      false: "min-h-9 items-start gap-2 py-1.5",
    },
  },
});
export const calendarTodoCheckboxStyles = cva("shrink-0", {
  variants: {
    compact: {
      true: "size-2 rounded-full border [&_svg]:hidden",
      false: "mt-0.5",
    },
  },
});
export const calendarTodoTitleStyles = cva("block", {
  variants: {
    compact: {
      true: "min-w-[min(100%,2.6em)] flex-1 truncate leading-none",
      false: "min-w-0 break-words",
    },
    completed: { true: "text-muted-foreground line-through" },
  },
});
