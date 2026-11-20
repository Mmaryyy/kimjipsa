import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { inputStyles } from "./ui.variants";

type InputProps = ComponentProps<"input"> & {
  /** glass: 유리 캡슐 안에 입력과 아이콘을 넣고, 포커스 테두리는 캡슐 전체에 그려요. */
  variant?: "default" | "inline" | "glass";
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
  const styles = cn(inputStyles({ variant }), className);
  if (variant !== "glass")
    return (
      <input
        data-slot="input"
        data-variant={variant === "inline" ? variant : undefined}
        data-od-id={odId}
        className={styles}
        {...props}
      />
    );
  return (
    <label data-od-id={odId} className={styles}>
      {icon}
      <input
        data-slot="input"
        className="h-full w-full min-w-0 border-0 bg-transparent py-1 text-foreground"
        {...props}
      />
    </label>
  );
}
