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
    <div
      data-slot="field-row"
      className={cn(formFieldRowStyles({ invalid }), className)}
      {...props}
    >
      <label htmlFor={htmlFor}>{label}</label>
      <div
        className={cn([
          "flex min-w-0 flex-1 justify-end [&_:is(input,select,textarea)]:min-h-[var(--ctl-h)]",
          "[&_:is(input,select,textarea)]:min-w-0 [&_:is(input,select,textarea)]:w-full",
          "[&_:is(input,select,textarea)]:bg-transparent [&_:is(input,select,textarea)]:text-right",
          "[&_textarea]:text-left",
        ])}
      >
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
          className="basis-full [color:var(--destructive)]"
        >
          {error}
        </Text>
      )}
    </div>
  );
}
