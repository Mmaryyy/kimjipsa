import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib";

type InputProps = ComponentProps<"input"> & {
  /** glass: 유리 캡슐 안에 입력과 아이콘을 넣고, 포커스 테두리는 캡슐 전체에 그려요. */
  variant?: "default" | "glass";
  icon?: ReactNode;
  "data-od-id"?: string;
};

export function Input({
  className,
  variant = "default",
  icon,
  "data-od-id": odId,
  ...props
}: InputProps) {
  if (variant === "default")
    return (
      <input
        data-slot="input"
        data-od-id={odId}
        className={cn(
          "w-full min-w-0 min-h-[var(--hit)] rounded-sm border-0 bg-muted px-3 py-2 text-foreground",
          className,
        )}
        {...props}
      />
    );
  return (
    <label
      data-od-id={odId}
      className={cn(
        "glass-surface kj-field-focus relative flex min-h-[var(--hit)] min-w-0 items-center gap-2 px-3",
        className,
      )}
    >
      {icon}
      <input
        data-slot="input"
        className="h-full w-full min-w-0 border-0 bg-transparent py-1 text-foreground"
        {...props}
      />
    </label>
  );
}
