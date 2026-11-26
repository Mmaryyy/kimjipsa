"use client";

import type { ComponentProps } from "react";
import { ResponsiveContainer } from "recharts";

type ChartContainerProps = Pick<
  ComponentProps<typeof ResponsiveContainer>,
  "children" | "className"
>;

export function ChartContainer({ children, className }: ChartContainerProps) {
  return (
    <ResponsiveContainer className={className} minWidth={0}>
      {children}
    </ResponsiveContainer>
  );
}
