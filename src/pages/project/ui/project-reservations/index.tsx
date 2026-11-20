import { useState } from "react";
import {
  projectPeriod,
  projectShortPeriod,
  reservationConflicts,
  reservationKindLabels,
  reservationStatusLabels,
  type ProjectDetail,
  type ProjectReservation,
} from "@/entities/project";
import { ProjectEventAction, ReservationEditor } from "@/features/project-edit";
import {
  List,
  ListRow,
  SectionHeader,
  StatusBadge,
  TextButton,
} from "@/shared/ui";

const tones = {
  reviewing: "warning",
  planned: "info",
  booked: "success",
  cancelled: "info",
} as const;
const amount = (value: number | null) =>
  value === null ? "미정" : `${value.toLocaleString("ko-KR")}원`;

function ReservationDetail({
  row,
  area,
  edit,
}: {
  row: ProjectReservation;
  area?: string;
  edit: () => void;
}) {
  const facts = [
    ["예약 번호", row.reference_no || "미정"],
    ["무료 취소 마감", projectPeriod(row.cancel_deadline, null, "미정")],
    ["결제 마감", projectPeriod(row.payment_deadline, null, "미정")],
    [
      "총액 / 결제액",
      `${amount(row.total_amount)} / ${amount(row.paid_amount)}`,
    ],
  ];
  if (area) facts.push(["영역", area]);
  return (
    <section aria-labelledby="prj-reservation-title">
      <SectionHeader id="prj-reservation-title" title={row.title} />
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
        <TextButton type="button" onClick={edit}>
          예약 수정
        </TextButton>
      </div>
    </section>
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
  const [selected, setSelected] = useState<string>();
  const current =
    reservations.find((row) => row.id === selected) ?? reservations[0];
  const editing = reservations.find((row) => row.id === editor);
  const conflicts = reservationConflicts(reservations);
  const conflictingIds = new Set(
    conflicts.flatMap(({ first, second }) => [first.id, second.id]),
  );

  return (
    <>
      {conflicts.length > 0 && (
        <aside
          data-od-id="prj-reservation-conflict"
          className="my-4 space-y-2 rounded-xl bg-warning-soft p-4 text-sm"
        >
          {conflicts.map(({ first, second, start, end }) => (
            <div key={`${first.id}:${second.id}`}>
              <p className="font-semibold text-warning-text">
                {reservationKindLabels[first.kind]} 이용 기간이 겹쳐요
              </p>
              <p className="wrap-anywhere">
                {first.title} ↔ {second.title} ·{" "}
                {projectShortPeriod(start, end, "")}
              </p>
            </div>
          ))}
        </aside>
      )}
      {reservations.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          아직 예약이 없어요.
        </p>
      )}
      <List>
        {reservations.map((row) => {
          const period = projectShortPeriod(
            row.starts_on,
            row.ends_on,
            "날짜 미정",
          );
          return (
            <ListRow
              key={row.id}
              className="border-b border-border/60"
              trailing={
                <div className="flex flex-wrap justify-end gap-1">
                  <StatusBadge variant={tones[row.status]}>
                    {reservationStatusLabels[row.status]}
                  </StatusBadge>
                  {conflictingIds.has(row.id) && (
                    <StatusBadge variant="warning">겹침 확인</StatusBadge>
                  )}
                </div>
              }
            >
              <TextButton
                type="button"
                aria-pressed={current?.id === row.id}
                onClick={() => setSelected(row.id)}
                className="text-left font-semibold text-foreground"
              >
                {row.title}
              </TextButton>
              <p className="text-sm text-muted-foreground">
                {reservationKindLabels[row.kind]} · {period}
              </p>
            </ListRow>
          );
        })}
      </List>
      {current && (
        <ReservationDetail
          key={current.id}
          row={current}
          area={areas.find((area) => area.id === current.area_id)?.name}
          edit={() => setEditor(current.id)}
        />
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
