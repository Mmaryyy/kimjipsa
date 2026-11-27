import Link from "next/link";
import {
  projectDeadlineDays,
  taskAssignees,
  useProjectWrite,
  type ProjectDetail,
} from "@/entities/project";
import { formatAmount, type AmountFormat } from "@/shared/lib";
import { Checkbox, List, SectionHeader, TextButton } from "@/shared/ui";

const warningDot = "inline-block size-1.5 shrink-0 rounded-full bg-warning";

type Deadline = {
  key: string;
  title: string;
  caption: string;
  days: number;
} & ({ taskId: string } | { href: string });

function collectDeadlines(
  data: ProjectDetail,
  today: string,
  amountFormat: AmountFormat,
) {
  const { project, tasks, decisions, reservations, areas, members } = data;
  const base = `/projects/${project.id}`;
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const assignees = new Map(
    taskAssignees(members).map(({ value, label }) => [value, label]),
  );
  const rows: Deadline[] = [];
  for (const task of tasks) {
    if (task.status === "done" || !task.due_on) continue;
    const days = projectDeadlineDays(task.due_on, today);
    if (days > 7) continue;
    const area = areaNames.get(task.area_id ?? "") ?? "영역 없음";
    const assignee = assignees.get(task.assignee_id ?? task.assignee_kind);
    const owner =
      task.assignee_kind === "member"
        ? (assignee ?? "탈퇴한 구성원")
        : assignee;
    const caption = ["할 일", area, owner].filter(Boolean).join(" · ");
    rows.push({
      key: task.id,
      taskId: task.id,
      title: task.title,
      caption,
      days,
    });
  }
  if (project.modules.includes("decisions")) {
    for (const item of decisions) {
      if (item.status !== "discussing" || !item.due_on) continue;
      const days = projectDeadlineDays(item.due_on, today);
      if (days > 14) continue;
      rows.push({
        key: item.id,
        title: item.question,
        caption: "결정 기한",
        days,
        href: `${base}/decisions`,
      });
    }
  }
  if (project.modules.includes("reservations")) {
    for (const item of reservations) {
      if (item.status === "cancelled") continue;
      const unpaid = (item.total_amount ?? 0) - (item.paid_amount ?? 0);
      const cutoffs = [
        {
          key: "cancel",
          date: item.cancel_deadline,
          caption: "무료 취소 마감",
        },
        {
          key: "payment",
          date: unpaid > 0 ? item.payment_deadline : null,
          caption: `결제 마감 · ${formatAmount(unpaid, amountFormat)} 남음`,
        },
      ];
      for (const { key, date, caption } of cutoffs) {
        if (!date) continue;
        const days = projectDeadlineDays(date, today);
        if (days < 0 || days > 14) continue;
        rows.push({
          key: `${item.id}-${key}`,
          title: item.title,
          caption,
          days,
          href: `${base}/reservations`,
        });
      }
    }
  }
  return rows.sort((a, b) => a.days - b.days);
}

function DeadlineLabel({ days }: { days: number }) {
  let label = "오늘";
  let tone = "bg-[var(--accent-soft)] text-[var(--accent-text)]";
  if (days < 0) {
    label = `${-days}일 지남`;
    tone = "bg-sys-gray5 text-foreground";
  } else if (days > 0) {
    label = `D-${days}`;
    tone =
      days <= 7
        ? "bg-sys-gray5 text-[var(--accent-text)]"
        : "bg-sys-gray5 text-foreground";
  }
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-0.5",
        "text-caption font-semibold tabular-nums",
        tone,
      ].join(" ")}
    >
      {days < 0 && <span aria-hidden className={warningDot} />}
      {label}
    </span>
  );
}

function OverviewDeadlines({
  data,
  today,
  amountFormat,
}: {
  data: ProjectDetail;
  today: string;
  amountFormat: AmountFormat;
}) {
  const write = useProjectWrite();
  const deadlines = collectDeadlines(data, today, amountFormat);
  const rowStyle = "flex min-h-11 items-center gap-3 py-2.5";

  return (
    <section aria-labelledby="prj-deadlines-title" data-od-id="prj-upcoming">
      <SectionHeader
        title="다가오는 마감"
        id="prj-deadlines-title"
        action={
          <TextButton asChild size="sm">
            <Link href={`/projects/${data.project.id}/tasks`}>할 일 전체</Link>
          </TextButton>
        }
      />
      {deadlines.length ? (
        <List variant="divided">
          {deadlines.map((row, index) => {
            const content = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{row.title}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    {row.caption}
                  </p>
                </div>
                <DeadlineLabel days={row.days} />
              </>
            );
            if ("href" in row) {
              return (
                <li key={row.key} data-od-id={`prj-upcoming-${index}`}>
                  <Link href={row.href} className={rowStyle}>
                    <span className="w-5.5 shrink-0" aria-hidden />
                    {content}
                  </Link>
                </li>
              );
            }
            const done =
              write.isPending &&
              write.variables?.action === "set_task_done" &&
              write.variables.id === row.taskId;
            return (
              <li
                key={row.key}
                className={rowStyle}
                data-od-id={`prj-upcoming-${index}`}
              >
                <Checkbox
                  className="size-5.5 shrink-0 rounded-full"
                  aria-label={`${row.title} 완료`}
                  checked={done}
                  disabled={write.isPending}
                  onCheckedChange={() =>
                    write.mutate({
                      action: "set_task_done",
                      projectId: data.project.id,
                      id: row.taskId,
                      done: true,
                    })
                  }
                />
                {content}
              </li>
            );
          })}
        </List>
      ) : (
        <p className="text-caption text-muted-foreground">
          다가오는 마감이 없어요.
        </p>
      )}
      {write.isError && (
        <p role="alert" className="text-caption text-error-text">
          {write.error.message}
        </p>
      )}
    </section>
  );
}

export default OverviewDeadlines;
