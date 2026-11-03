import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "min-h-hit w-full min-w-0 rounded-sm border-0 bg-muted px-3 py-2 text-foreground disabled:cursor-default",
      className,
    )}
    {...props}
  />
);
export default Textarea;
