import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  projectBudget,
  projectCandidates,
  projectCandidateSummary,
  projectModuleLabels,
  projectShortPeriod,
  type ProjectDetail,
} from "@/entities/project";
import { formatAmount, type AmountFormat } from "@/shared/lib";
import { List, SectionHeader } from "@/shared/ui";

function OverviewModules({
  data,
  remaining,
  amountFormat,
}: {
  data: ProjectDetail;
  remaining: number;
  amountFormat: AmountFormat;
}) {
  const {
    project,
    lists,
    listItems,
    decisions,
    reservations,
    itinerary,
    expenses,
  } = data;
  const money = (value: number | bigint) => formatAmount(value, amountFormat);
  const base = `/projects/${project.id}`;
  const byList = Map.groupBy(listItems, (item) => item.list_id);
  const candidates = lists.filter((list) => list.kind === "candidates");
  const people = lists.filter((list) => list.kind === "people");
  const { selected, estimate } = projectCandidateSummary(
    candidates.flatMap((list) => projectCandidates(list, data).candidates),
  );

  const rosterCount = people.reduce(
    (sum, list) => sum + (byList.get(list.id)?.length ?? 0),
    0,
  );
  const discussing = decisions.filter(
    (item) => item.status === "discussing",
  ).length;
  const unpaid = reservations
    .filter((item) => item.status !== "cancelled")
    .reduce(
      (sum, item) =>
        sum + BigInt((item.total_amount ?? 0) - (item.paid_amount ?? 0)),
      BigInt(0),
    );
  const dates = itinerary
    .flatMap((item) => [item.starts_on, item.ends_on ?? item.starts_on])
    .sort();
  const budget = projectBudget(expenses, project.budget_limit);
  const cap =
    project.budget_limit === null
      ? "상한 미정"
      : `상한 ${money(project.budget_limit)}`;

  const rows = [
    { path: "tasks", label: "할 일", detail: `${remaining}개 남음` },
  ];
  const detail = {
    decisions: discussing ? `논의 중 ${discussing}개` : "논의 중인 결정 없음",
    reservations: `결제 남음 ${money(unpaid)}`,
    itinerary: dates.length
      ? `${projectShortPeriod(dates[0], dates.at(-1) ?? null, "")} · ${itinerary.length}개`
      : "비어 있어요",
    budget: `${money(budget.actual)} 지출 · ${cap}`,
  };
  for (const projectModule of project.modules) {
    if (projectModule === "lists") {
      const candidateDetails =
        estimate === null
          ? `선택 ${selected}개`
          : `선택 ${selected}개 · 예상 ${money(estimate)}`;
      rows.push(
        {
          path: "lists?kind=candidates",
          label: "후보 목록",
          detail: candidates.length ? candidateDetails : "아직 목록이 없어요",
        },
        {
          path: "lists?kind=people",
          label: "명단",
          detail: people.length
            ? `${people.length === 1 ? people[0].name : `명단 ${people.length}개`} · ${rosterCount}명`
            : "아직 명단이 없어요",
        },
      );
    } else {
      rows.push({
        path: projectModule,
        label: projectModuleLabels[projectModule],
        detail: detail[projectModule],
      });
    }
  }

  return (
    <section aria-labelledby="prj-modules-title" data-od-id="prj-modules">
      <SectionHeader title="구성 요소" id="prj-modules-title" />
      <List variant="divided">
        {rows.map(({ path, label, detail }, index) => (
          <li key={path}>
            <Link
              href={`${base}/${path}`}
              data-od-id={`prj-module-${index}`}
              className="flex min-h-11 items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-semibold">{label}</p>
                <p className="truncate text-caption text-muted-foreground tabular-nums">
                  {detail}
                </p>
              </div>
              <ChevronRight
                aria-hidden
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </List>
    </section>
  );
}

export default OverviewModules;
