import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { formFieldRowStyles } from "./ui.variants";
import { Text } from "./text";
type FormFieldControlProps = Pick<
  ComponentProps<"input">,
  "id" | "aria-invalid" | "aria-describedby"
>;
type FormFieldRowProps = Omit<ComponentProps<"div">, "children"> & {
  children: (controlProps: FormFieldControlProps) => ReactNode;
  label: string;
  htmlFor: string;
  invalid?: boolean;
  error?: string;
};
export function FormFieldRow({
  label,
  htmlFor,
  invalid = false,
  error,
  className,
  children,
  ...props
}: FormFieldRowProps) {
  return (
    <div className={cn(formFieldRowStyles({ invalid }), className)} {...props}>
      <label htmlFor={htmlFor}>{label}</label>
      <div className="kj-form-field-row-control">
        {children({
          id: htmlFor,
          "aria-invalid": invalid || undefined,
          "aria-describedby": invalid && error ? `${htmlFor}-error` : undefined,
        })}
      </div>
      {invalid && error && (
        <Text
          as="p"
          variant="caption"
          id={`${htmlFor}-error`}
          role="alert"
          className="kj-form-field-row-error"
        >
          {error}
        </Text>
      )}
    </div>
  );
}
