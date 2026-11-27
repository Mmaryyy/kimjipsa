"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartContainer } from "@/shared/ui/chart";

interface Props {
  percent: number;
}

const ProjectProgressGauge = ({ percent }: Props) => (
  <div
    className="relative h-[78px] w-[140px] shrink-0 overflow-hidden"
    role="img"
    aria-label={`전체 준비 ${percent}%`}
  >
    <div className="h-[140px] w-full" aria-hidden>
      <ChartContainer>
        <RadialBarChart
          data={[{ percent }]}
          accessibilityLayer={false}
          cx={70}
          cy={72}
          innerRadius={60}
          outerRadius={70}
          startAngle={180}
          endAngle={0}
          barSize={10}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <RadialBar
            dataKey="percent"
            fill="var(--sys-cyan)"
            background={{ fill: "var(--fill-tertiary)" }}
            cornerRadius={5}
            forceCornerRadius
            isAnimationActive={false}
            stroke="none"
          />
        </RadialBarChart>
      </ChartContainer>
    </div>
    <span
      aria-hidden
      className="absolute inset-x-0 bottom-0 text-center text-4xl font-semibold tabular-nums"
    >
      {percent}
      <span className="text-2xl">%</span>
    </span>
  </div>
);

export default ProjectProgressGauge;
