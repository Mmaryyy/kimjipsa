"use client";

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
  showLabel?: boolean;
  errorClassName?: string;
};
export function FormFieldRow({
  label,
  htmlFor,
  invalid = false,
  error,
  showLabel = true,
  errorClassName,
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
      {showLabel && (
        <label
          htmlFor={htmlFor}
          onClick={(event) => {
            if (
              document
                .getElementById(htmlFor)
                ?.matches('button:not([role="switch"]):not([role="checkbox"])')
            )
              event.preventDefault();
          }}
        >
          {label}
        </label>
      )}
      <div
        className={cn([
          "flex min-w-0 flex-1 justify-end [&_:is(input,textarea)]:min-h-[var(--ctl-h)]",
          "[&_:is(input,textarea)]:min-w-0 [&_:is(input,textarea)]:bg-transparent",
          "[&_:is(input:not([data-variant=inline]),textarea)]:w-full",
          "[&_input:not([data-variant=inline])]:text-right",
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
          className={cn(
            "basis-full [color:var(--destructive)]",
            errorClassName,
          )}
        >
          {error}
        </Text>
      )}
    </div>
  );
}
