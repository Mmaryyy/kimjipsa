"use client";
import { Button } from "../button";
import { cn } from "@/shared/lib";
import { useCallback, type ComponentProps } from "react";
export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn(
        "cursor-pointer min-h-hit rounded-control px-4 whitespace-normal text-left",
        className,
      )}
      onClick={handleClick}
      size={size}
      type="button"
      variant="gray"
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
