"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  reservationInput,
  reservationKindLabels,
  reservationKinds,
  reservationStatusLabels,
  reservationStatuses,
  type ReservationInput,
  type ProjectArea,
  type ProjectReservation,
} from "@/entities/project";
import { FormField } from "@/shared/ui";
import type { FieldRenderProps } from "@/shared/ui/form-field";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";

const Field = FormField<ReservationInput>;
const emptyReservation: ReservationInput = {
  title: "",
  area_id: null,
  kind: "lodging",
  status: "reviewing",
  starts_on: null,
  ends_on: null,
  reference_no: "",
  links: [],
  cancel_deadline: null,
  payment_deadline: null,
  total_amount: null,
  paid_amount: null,
  memo: "",
};

function ReservationEditor({
  projectId,
  areas,
  reservation,
  onClose,
}: {
  projectId: string;
  areas: ProjectArea[];
  reservation?: ProjectReservation;
  onClose: () => void;
}) {
  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationInput),
    defaultValues: reservation ?? emptyReservation,
  });

  return (
    <ProjectFormSheet
      form={form}
      title={reservation ? "예약 수정" : "예약 추가"}
      odId="prj-reservation-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_reservation",
        projectId,
        id: reservation?.id,
        item,
      })}
      deletion={
        reservation && {
          command: {
            action: "delete_reservation",
            projectId,
            id: reservation.id,
          },
          name: reservation.title,
          description: "프로젝트에서 이 예약을 삭제해요.",
        }
      }
    >
      <Field name="title" label="제목" inputProps={{ maxLength: 100 }} />
      <Field
        name="area_id"
        label="영역"
        type="select"
        inputProps={{ variant: "default" }}
        noneLabel="영역 없음"
        options={areas.map(({ id, name }) => ({ value: id, label: name }))}
      />
      <Field
        name="kind"
        label="종류"
        type="select"
        inputProps={{ variant: "default" }}
        options={reservationKinds.map((value) => ({
          value,
          label: reservationKindLabels[value],
        }))}
      />
      <Field
        name="status"
        label="상태"
        type="select"
        inputProps={{ variant: "default" }}
        options={reservationStatuses.map((value) => ({
          value,
          label: reservationStatusLabels[value],
        }))}
      />
      {(
        [
          ["starts_on", "이용 시작"],
          ["ends_on", "이용 종료"],
        ] as const
      ).map(([name, label]) => (
        <Field
          key={name}
          name={name}
          label={label}
          render={(field: FieldRenderProps<ReservationInput, typeof name>) => (
            <ProjectDateControl {...field} label={label} />
          )}
        />
      ))}
      <Field
        name="reference_no"
        label="예약 번호"
        inputProps={{ maxLength: 100 }}
      />
      <Field
        name="links"
        label="링크"
        type="textarea"
        inputProps={{ rows: 2 }}
        format={(links) => links.join("\n")}
        parse={(text) => text.split("\n")}
        hint="링크가 여러 개면 줄을 나눠 입력해 주세요."
      />
      <Field
        name="cancel_deadline"
        label="무료 취소 마감"
        render={(field) => (
          <ProjectDateControl {...field} label="무료 취소 마감" />
        )}
      />
      <Field
        name="payment_deadline"
        label="결제 마감"
        render={(field) => <ProjectDateControl {...field} label="결제 마감" />}
      />
      {(
        [
          ["total_amount", "총액"],
          ["paid_amount", "결제액"],
        ] as const
      ).map(([name, label]) => (
        <Field
          key={name}
          name={name}
          label={label}
          type="number"
          inputProps={{ min: 0, step: "any" }}
          format={(amount) => amount ?? NaN}
          parse={(amount) => (Number.isNaN(amount) ? null : amount)}
        />
      ))}
      <Field
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default ReservationEditor;
