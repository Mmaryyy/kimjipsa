import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { projectBudget } from "@/entities/project";
import { cn, formatAmount, type AmountFormat } from "@/shared/lib";
import { TextButton } from "@/shared/ui";
import { ChartContainer } from "@/shared/ui/chart";

interface Props {
  budget: ReturnType<typeof projectBudget>;
  limit: number | null;
  amountFormat: AmountFormat;
  onEditLimit: () => void;
}

const zero = BigInt(0);
const paidColor = "var(--label-secondary)";
const plannedColor = "var(--sys-gray3)";
const spareColor = "var(--fill-tertiary)";
const overColor = "var(--warning)";

const ProjectBudgetSummary = ({
  budget,
  limit,
  amountFormat,
  onEditLimit,
}: Props) => {
  const { actual, remaining } = budget;
  const total = actual + remaining;
  const cap = limit === null ? total : BigInt(limit);
  const over = total > cap ? total - cap : zero;
  const spare = cap > total ? cap - total : zero;
  const paidWithinLimit = actual > cap ? cap : actual;
  const remainingWithinLimit = total - over - paidWithinLimit;
  const scale = total + spare;
  const chartData = [
    {
      paid: Number(paidWithinLimit),
      planned: Number(remainingWithinLimit),
      spare: Number(spare),
      over: Number(over),
    },
  ];
  const legend = [
    { label: "실제 결제", amount: actual, color: paidColor },
    { label: "남은 예상", amount: remaining, color: plannedColor },
  ];
  if (limit !== null) {
    legend.push(
      over > zero
        ? { label: "상한 초과 예상", amount: over, color: overColor }
        : { label: "상한까지 여유", amount: spare, color: spareColor },
    );
  }

  const actualShare =
    budget.percent === null
      ? actual > zero
        ? "상한 초과"
        : "—"
      : `${budget.percent.toLocaleString("ko-KR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`;
  const formattedTotal = formatAmount(total, amountFormat);

  return (
    <section
      aria-label="예산 요약"
      data-od-id="prj-budget-summary"
      className="mt-4 min-w-0 rounded-control bg-fill-quaternary p-4"
    >
      <div className="flex items-baseline justify-between gap-2 text-caption-sm text-muted-foreground">
        <span>예상 총액</span>
        {limit === null ? (
          <TextButton size="sm" onClick={onEditLimit}>
            상한 정하기
          </TextButton>
        ) : (
          <span>
            상한 대비 실제{" "}
            <strong className="text-foreground tabular-nums">
              {actualShare}
            </strong>
          </span>
        )}
      </div>
      <p className="font-bold tracking-tight tabular-nums">
        <span className="text-[length:var(--type-display-size)] leading-[var(--type-display-lh)]">
          {amountFormat === "won"
            ? formattedTotal.slice(0, -1)
            : formattedTotal}
        </span>
        {amountFormat === "won" && (
          <span className="ml-1 text-headline">원</span>
        )}
      </p>
      {limit !== null && (
        <p className="mt-0.5 text-caption text-muted-foreground tabular-nums">
          / 상한 {formatAmount(limit, amountFormat)}
        </p>
      )}
      <div className="mt-3 h-5 overflow-hidden" aria-hidden>
        {scale === zero ? (
          <div className="relative top-1 h-3 rounded-[var(--r-bar)] bg-fill-tertiary" />
        ) : (
          <ChartContainer>
            <BarChart
              data={chartData}
              accessibilityLayer={false}
              layout="vertical"
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" domain={[0, Number(scale)]} hide />
              <YAxis type="category" hide />
              <Bar
                dataKey="paid"
                stackId="budget"
                fill={paidColor}
                isAnimationActive={false}
                barSize={12}
              />
              <Bar
                dataKey="planned"
                stackId="budget"
                fill={plannedColor}
                isAnimationActive={false}
              />
              <Bar
                dataKey="spare"
                stackId="budget"
                fill={spareColor}
                isAnimationActive={false}
              />
              <Bar
                dataKey="over"
                stackId="budget"
                fill={overColor}
                isAnimationActive={false}
              />
              {limit !== null && over > zero && (
                <ReferenceLine
                  x={limit}
                  stroke="var(--label)"
                  strokeWidth={2}
                />
              )}
            </BarChart>
          </ChartContainer>
        )}
      </div>
      <dl className="mt-2 space-y-1.5 text-caption">
        {legend.map(({ label, amount, color }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-[var(--r-bar)]"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {label}
            </dt>
            <dd
              className={cn(
                "text-right whitespace-nowrap tabular-nums",
                color === overColor && "font-semibold text-warning-text",
              )}
            >
              {formatAmount(amount, amountFormat)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default ProjectBudgetSummary;
