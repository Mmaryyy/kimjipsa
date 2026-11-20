import { cva } from "class-variance-authority";

export const projectFormFieldStyles = cva([], {
  variants: {
    columns: {
      1: [
        "[&_[data-slot=field-row]]:min-w-0",
        "[&_[data-slot=field-row]:not(:has([role=switch]))]:grid",
        "[&_[data-slot=field-row]:not(:has([role=switch]))]:gap-1.5",
        "[&_[data-slot=field-row]:not(:has([role=switch]))>div]:justify-start",
        "[&_[data-slot=field-row]>label]:text-sm [&_[data-slot=field-row]>label]:text-muted-foreground",
        "[&_[data-slot=field-row]_:is(input,textarea)]:min-h-11",
        "[&_[data-slot=field-row]_:is(input,textarea)]:rounded-sm",
        "[&_[data-slot=field-row]_:is(input,textarea)]:bg-muted",
        "[&_[data-slot=field-row]_:is(input,textarea)]:px-3",
        "[&_[data-slot=field-row]_:is(input,textarea)]:text-start",
        "[&_[data-slot=field-row]_textarea]:min-h-19 [&_[data-slot=field-row]_textarea]:py-2",
      ],
      2: "grid min-w-0 grid-cols-2 items-start gap-3",
    },
  },
  defaultVariants: { columns: 1 },
});
