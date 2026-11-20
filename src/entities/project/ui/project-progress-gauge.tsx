const arc = "M 5 72 A 65 65 0 0 1 135 72";

export function ProjectProgressGauge({ percent }: { percent: number }) {
  return (
    <svg
      width="140"
      height="78"
      viewBox="0 0 140 78"
      role="img"
      aria-label={`전체 준비 ${percent}%`}
    >
      <g fill="none" strokeWidth="10" strokeLinecap="round">
        <path d={arc} stroke="var(--fill-tertiary)" />
        <path
          d={arc}
          stroke="var(--sys-cyan)"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
          opacity={percent === 0 ? 0 : undefined}
        />
      </g>
      <text
        x="70"
        y="69"
        textAnchor="middle"
        className="fill-foreground text-4xl font-semibold tabular-nums"
      >
        {percent}
        <tspan className="text-2xl">%</tspan>
      </text>
    </svg>
  );
}
