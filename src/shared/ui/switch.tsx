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
      className={cn("kj-switch kj-hit", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="kj-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
