import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib";
import { textareaStyles } from "../ui.variants";

type TextareaProps = ComponentProps<"textarea"> &
  VariantProps<typeof textareaStyles>;

const Textarea = ({ variant, className, ...props }: TextareaProps) => (
  <textarea
    data-slot="textarea"
    className={cn(textareaStyles({ variant }), className)}
    {...props}
  />
);
export default Textarea;
