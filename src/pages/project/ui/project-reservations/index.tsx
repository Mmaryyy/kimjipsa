import { format, parseISO } from "date-fns";
import { useRef, useState } from "react";
import {
  ProjectProgressBar,
  projectDeadlineDays,
  projectPeriod,
  projectToday,
  reservationConflicts,
  reservationKindLabels,
  reservationStatusLabels,
  type ProjectDetail,
  type ProjectReservation,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { ProjectEventAction, ReservationEditor } from "@/features/project-edit";
import { cn, formatAmount, type AmountFormat } from "@/shared/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  EmptyState,
  List,
  SectionHeader,
  Sheet,
  StatusBadge,
  TextButton,
} from "@/shared/ui";

const tones = {
  reviewing: "neutral",
  planned: "info",
  booked: "success",
  cancelled: "neutral",
} as const;
const amount = (value: number | null, format: AmountFormat) =>
  value === null ? "미정" : formatAmount(value, format);

function ReservationDetail({
  row,
  amountFormat,
  area,
}: {
  row: ProjectReservation;
  amountFormat: AmountFormat;
  area?: string;
}) {
  const facts = [
    ["예약 번호", row.reference_no || "미정"],
    ["무료 취소 마감", projectPeriod(row.cancel_deadline, null, "미정")],
    ["결제 마감", projectPeriod(row.payment_deadline, null, "미정")],
    [
      "총액 / 결제액",
      [row.total_amount, row.paid_amount]
        .map((value) => amount(value, amountFormat))
        .join(" / "),
    ],
  ];
  if (area) facts.push(["영역", area]);
  return (
    <>
      <dl
        data-od-id="prj-reservation-detail"
        className="border-y border-border/60 py-2 text-sm"
      >
        {facts.map(([term, description]) => (
          <div
            key={term}
            className="flex flex-wrap justify-between gap-x-3 py-2 wrap-anywhere"
          >
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="font-medium">{description}</dd>
          </div>
        ))}
      </dl>
      {row.memo && (
        <p className="mt-2 text-sm wrap-anywhere whitespace-pre-wrap">
          {row.memo}
        </p>
      )}
      {row.links.map((link, index) => (
        <TextButton asChild key={index}>
          <a href={link} target="_blank" rel="noreferrer">
            예약 링크{row.links.length > 1 ? ` ${index + 1}` : ""} ↗
          </a>
        </TextButton>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <ProjectEventAction row={row} source="reservations" />
      </div>
    </>
  );
}

const activeStatuses = ["planned", "reviewing", "booked"] as const;
const shortDate = (date: string) => format(parseISO(date), "M.d");
const warningDot = "inline-block size-1.5 shrink-0 rounded-full bg-warning";
const remainingAmount = (row: ProjectReservation) =>
  (row.total_amount ?? 0) - (row.paid_amount ?? 0);

function reservationDeadlines(row: ProjectReservation, today: string) {
  const cutoffs = [
    { label: "무료 취소", date: row.cancel_deadline },
    {
      label: "결제 마감",
      date:
        row.total_amount === null || remainingAmount(row) > 0
          ? row.payment_deadline
          : null,
    },
  ];
  return cutoffs.flatMap(({ label, date }) =>
    date ? [{ label, date, days: projectDeadlineDays(date, today) }] : [],
  );
}

function DeadlineBadge({ days }: { days: number }) {
  const label =
    days < 0 ? `${-days}일 지남` : days === 0 ? "오늘" : `D-${days}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control bg-sys-gray5 px-2 py-0.5",
        "text-caption font-semibold text-foreground tabular-nums",
        days >= 0 && days <= 7 && "text-[var(--accent-text)]",
        days === 0 && "bg-[var(--accent-soft)]",
      )}
    >
      {days < 0 && <span className={warningDot} aria-hidden />}
      {label}
    </span>
  );
}

function ReservationSummary({
  reservations,
  today,
  amountFormat,
}: {
  reservations: ProjectReservation[];
  today: string;
  amountFormat: AmountFormat;
}) {
  const remaining = reservations.reduce(
    (sum, row) => sum + remainingAmount(row),
    0,
  );
  const deadlines = reservations
    .flatMap((row) =>
      reservationDeadlines(row, today).map((deadline) => ({
        ...deadline,
        title: row.title,
      })),
    )
    .sort((a, b) => a.days - b.days);
  const next = deadlines.find(({ days }) => days >= 0) ?? deadlines.at(-1);

  return (
    <section
      aria-label="결제 요약"
      data-od-id="prj-reservation-summary"
      className="mt-4 rounded-control bg-fill-quaternary p-4"
    >
      <p className="text-caption-sm text-muted-foreground">결제 남은 금액</p>
      <p
        className={cn(
          "text-[length:var(--type-display-size)] leading-[var(--type-display-lh)]",
          "font-bold tracking-[var(--type-display-tracking)] tabular-nums wrap-anywhere",
        )}
      >
        {amountFormat === "won" ? (
          <>
            {formatAmount(remaining, "number")}
            <span className="ml-1 text-headline font-semibold">원</span>
          </>
        ) : (
          formatAmount(remaining, amountFormat)
        )}
      </p>
      {next && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-caption text-muted-foreground">
          <span>다음 마감</span>
          <strong className="font-semibold text-foreground tabular-nums">
            <time dateTime={next.date}>{shortDate(next.date)}</time>{" "}
            {next.label}
          </strong>
          <span className="min-w-0 wrap-anywhere">· {next.title}</span>
          <DeadlineBadge days={next.days} />
        </p>
      )}
    </section>
  );
}

function ReservationPayment({
  row,
  amountFormat,
}: {
  row: ProjectReservation;
  amountFormat: AmountFormat;
}) {
  const total = row.total_amount;
  if (total === null) {
    return (
      <span className="mt-2 block text-caption text-muted-foreground">
        금액 미정
      </span>
    );
  }
  const paid = row.paid_amount ?? 0;
  const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
  const paidLabel = formatAmount(paid, amountFormat);
  const totalLabel = formatAmount(total, amountFormat);

  return (
    <span className="mt-2 block space-y-1 text-caption tabular-nums">
      <span className="flex justify-between gap-2 whitespace-normal">
        <span>
          결제 <strong className="font-semibold">{paidLabel}</strong>
        </span>
        <span className="text-right text-muted-foreground">
          총액 {totalLabel}
        </span>
      </span>
      <ProjectProgressBar
        label={`총액 ${totalLabel} 중 ${paidLabel} 결제, ${percent}%`}
        done={paid}
        total={total}
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full bg-fill-tertiary",
          "[&::-webkit-progress-bar]:bg-transparent",
          "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
          "[&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
        )}
      />
      <span className="block text-muted-foreground">
        남은 금액{" "}
        <strong className="font-semibold text-foreground">
          {formatAmount(remainingAmount(row), amountFormat)}
        </strong>{" "}
        · {percent}% 결제
      </span>
    </span>
  );
}

function ReservationRow({
  row,
  area,
  overlaps,
  today,
  amountFormat,
  onSelect,
}: {
  row: ProjectReservation;
  area: string;
  overlaps: boolean;
  today: string;
  amountFormat: AmountFormat;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const cancelled = row.status === "cancelled";
  const kind = reservationKindLabels[row.kind];
  const period =
    [row.starts_on, row.ends_on === row.starts_on ? null : row.ends_on]
      .filter((date) => date !== null)
      .map(shortDate)
      .join(" – ") || "날짜 미정";
  const deadlines = cancelled ? [] : reservationDeadlines(row, today);

  return (
    <li>
      <TextButton
        tone="neutral"
        aria-haspopup="dialog"
        data-od-id={`prj-reservation-${row.id}`}
        onClick={(event) => onSelect(event.currentTarget)}
        className="block w-full py-4 text-left font-normal whitespace-normal"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 wrap-anywhere">
            <span className="block text-caption-sm font-medium text-muted-foreground">
              {kind} · {area}
            </span>
            <span
              className={cn(
                "block text-headline font-semibold",
                cancelled && "text-label-done",
              )}
            >
              {row.title}
            </span>
            <span className="mt-0.5 block text-caption text-muted-foreground tabular-nums">
              {period}
              {row.reference_no && ` · 예약 번호 ${row.reference_no}`}
            </span>
          </span>
          <StatusBadge className="shrink-0" variant={tones[row.status]}>
            {reservationStatusLabels[row.status]}
          </StatusBadge>
        </span>
        {overlaps && (
          <span data-od-id="prj-reservation-conflict" className="mt-1 block">
            <StatusBadge variant="warning" className="text-foreground">
              같은 기간에 다른 {kind} 예약이 있어요
            </StatusBadge>
          </span>
        )}
        {!cancelled && (
          <ReservationPayment row={row} amountFormat={amountFormat} />
        )}
        {deadlines.length > 0 && (
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption tabular-nums">
            {deadlines.map(({ label, date, days }, index) => {
              const soon = days >= 0 && days <= 14;
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-muted-foreground"
                >
                  {index > 0 && <span aria-hidden>·</span>}
                  {soon && <span className={warningDot} aria-hidden />}
                  <time
                    dateTime={date}
                    className={cn(soon && "font-medium text-foreground")}
                  >
                    {label} {shortDate(date)}
                  </time>
                  {soon && (
                    <span className="text-foreground">
                      · {days === 0 ? "오늘" : `D-${days}`}
                    </span>
                  )}
                  {days < 0 && <DeadlineBadge days={days} />}
                </span>
              );
            })}
          </span>
        )}
      </TextButton>
    </li>
  );
}

function ProjectReservations({
  data,
  editor,
  setEditor,
}: {
  data: ProjectDetail;
  editor?: string;
  setEditor: (id?: string) => void;
}) {
  const { project, reservations, areas } = data;
  const { data: account } = useAccount();
  const amountFormat = account?.amountFormat ?? "won";
  const [selected, setSelected] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const current = reservations.find((row) => row.id === selected);
  const editing = reservations.find((row) => row.id === editor);
  const today = projectToday();
  const conflicts = reservationConflicts(reservations);
  const conflictingIds = new Set(
    conflicts.flatMap(({ first, second }) => [first.id, second.id]),
  );
  const sorted = [...reservations].sort((a, b) =>
    (a.starts_on ?? "9").localeCompare(b.starts_on ?? "9"),
  );
  const cancelled = sorted.filter(({ status }) => status === "cancelled");
  const active = sorted.filter(({ status }) => status !== "cancelled");
  const groups = activeStatuses
    .map((status) => ({
      status,
      rows: active.filter((row) => row.status === status),
    }))
    .filter(({ rows }) => rows.length > 0);

  function renderRows(rows: ProjectReservation[]) {
    return (
      <List variant="divided">
        {rows.map((row) => (
          <ReservationRow
            key={row.id}
            row={row}
            area={
              areas.find((area) => area.id === row.area_id)?.name ?? "영역 없음"
            }
            overlaps={conflictingIds.has(row.id)}
            today={today}
            amountFormat={amountFormat}
            onSelect={(button) => {
              trigger.current = button;
              setSelected(row.id);
            }}
          />
        ))}
      </List>
    );
  }

  return (
    <>
      {reservations.length === 0 ? (
        <EmptyState message="아직 예약이 없어요." />
      ) : (
        <ReservationSummary
          reservations={active}
          today={today}
          amountFormat={amountFormat}
        />
      )}
      {groups.map(({ status, rows }, index) => {
        const id = `prj-reservation-group-${index}`;
        return (
          <section
            key={status}
            aria-labelledby={`${id}-title`}
            data-od-id={id}
            className="[&>[data-slot=section-header]]:justify-start"
          >
            <SectionHeader
              id={`${id}-title`}
              title={reservationStatusLabels[status]}
              action={
                <span className="text-title-sm text-muted-foreground tabular-nums">
                  {rows.length}
                </span>
              }
            />
            {renderRows(rows)}
          </section>
        );
      })}
      {cancelled.length > 0 && (
        <Accordion type="single" collapsible className="mt-5">
          <AccordionItem value="cancelled" variant="plain">
            <AccordionTrigger heading="h2" tone="muted">
              취소 <span className="tabular-nums">{cancelled.length}</span>
            </AccordionTrigger>
            <AccordionContent>{renderRows(cancelled)}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {current && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSelected(undefined);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          title={current.title}
          description="예약 정보와 연결 일정"
          action={
            <TextButton onClick={() => setEditor(current.id)}>수정</TextButton>
          }
        >
          <ReservationDetail
            row={current}
            amountFormat={amountFormat}
            area={areas.find((area) => area.id === current.area_id)?.name}
          />
        </Sheet>
      )}
      {editor !== undefined && (editor === "" || editing) && (
        <ReservationEditor
          key={editor}
          projectId={project.id}
          areas={areas}
          reservation={editing}
          onClose={() => setEditor()}
        />
      )}
    </>
  );
}

export default ProjectReservations;
