"use client";
import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
// shadcn/ui의 Radix Root/Thumb·Root/Indicator 구성을 디자인 토큰에 맞춰 사용해요.
export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        [
          "inline-flex h-6.25 w-10.5 flex-none cursor-pointer items-center rounded-[var(--r-round)]",
          "bg-input p-0.5 data-[state=checked]:bg-[var(--status-ok)] disabled:cursor-default",
          "disabled:opacity-50 kj-hit",
        ],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn([
          "block size-5.25 rounded-[var(--r-round)] bg-primary-foreground transition-transform",
          "duration-[var(--dur)] ease-[var(--ease)] data-[state=checked]:translate-x-4.25",
          "motion-reduce:transition-none",
        ])}
      />
    </SwitchPrimitive.Root>
  );
}
