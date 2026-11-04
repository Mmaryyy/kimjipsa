"use client";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { Button } from "../button";
import Textarea from "../textarea";
// Existing upload and retry state stays with the caller; no second attachment store.
export const PromptInput = ({
  className,
  ...props
}: ComponentProps<"form">) => (
  <form
    className={cn("w-full space-y-2 rounded-control bg-card p-3", className)}
    {...props}
  />
);
export const PromptInputTextarea = ({
  className,
  ...props
}: ComponentProps<typeof Textarea>) => (
  <Textarea
    className={cn(
      "max-h-40 resize-none bg-transparent [field-sizing:content]",
      className,
    )}
    {...props}
  />
);
export const PromptInputFooter = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn("flex items-center justify-between gap-3", className)}
    {...props}
  />
);
export const PromptInputSubmit = ({
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    type="submit"
    className={cn("disabled:opacity-40", className)}
    {...props}
  />
);
