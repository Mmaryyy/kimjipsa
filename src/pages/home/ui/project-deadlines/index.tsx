import Link from "next/link";
import {
  projectDeadlineDays,
  projectExpenseDate,
  useHomeDeadlines,
} from "@/entities/project";
import {
  EmptyState,
  ErrorState,
  List,
  SectionHeader,
  Skeleton,
} from "@/shared/ui";

const presentation = {
  task: { section: "tasks", label: "할 일" },
  decision: { section: "decisions", label: "결정" },
  reservation_cancel: {
    section: "reservations",
    label: "예약",
    detail: "무료 취소",
  },
  reservation_payment: {
    section: "reservations",
    label: "예약",
    detail: "결제",
  },
} as const;

export default function ProjectDeadlines({
  today,
  ownerNames,
}: {
  today: string;
  ownerNames: Record<string, string>;
}) {
  const query = useHomeDeadlines(today);
  return (
    <section
      aria-labelledby="home-project-deadlines-title"
      data-od-id="prj-home-deadlines"
    >
      <SectionHeader
        id="home-project-deadlines-title"
        title="다가오는 프로젝트 마감"
      />
      {query.isPending && <Skeleton className="h-24" />}
      {query.isError && (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && query.data.length === 0 && (
        <EmptyState message="다가오는 프로젝트 마감이 없어요." />
      )}
      {!!query.data?.length && (
        <List variant="divided">
          {query.data.map((row) => {
            const kind = presentation[row.kind];
            const { section, label } = kind;
            const owner =
              row.assigneeKind === "together"
                ? "함께"
                : ownerNames[row.assigneeId ?? ""];
            const caption = [
              row.projectTitle,
              label,
              "detail" in kind ? kind.detail : null,
              owner,
            ]
              .filter(Boolean)
              .join(" · ");
            const days = projectDeadlineDays(row.date, today);
            return (
              <li key={`${row.kind}:${row.id}`}>
                <Link
                  href={`/projects/${row.projectId}/${section}`}
                  className="flex min-h-11 items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.title}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {caption}
                    </p>
                  </div>
                  {days < 0 && (
                    <span
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-control " +
                        "bg-sys-gray5 px-2 py-0.5 text-caption"
                      }
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-warning"
                      />
                      {-days}일 지남
                    </span>
                  )}
                  <time
                    dateTime={row.date}
                    className="shrink-0 text-caption tabular-nums"
                  >
                    {projectExpenseDate(row.date, today)}
                  </time>
                </Link>
              </li>
            );
          })}
        </List>
      )}
    </section>
  );
}
