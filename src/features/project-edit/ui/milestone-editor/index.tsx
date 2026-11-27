"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  milestoneInput,
  type MilestoneInput,
  type ProjectArea,
  type ProjectMilestone,
} from "@/entities/project";
import { FormField, Select, Switch, useConfirm } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";
import { projectFormFieldStyles } from "../project-form-sheet/project-form.styles";

const Field = FormField<MilestoneInput>;
const emptyMilestone: MilestoneInput = {
  title: "",
  area_id: null,
  starts_on: null,
  ends_on: null,
  is_tentative: false,
  memo: "",
};

function MilestoneEditor({
  projectId,
  areas,
  milestones,
  initialMilestoneId,
  afterSave,
  onClose,
}: {
  projectId: string;
  areas: ProjectArea[];
  milestones: ProjectMilestone[];
  initialMilestoneId?: string;
  afterSave?: (id: string, item: MilestoneInput) => void;
  onClose: () => void;
}) {
  const ordered = [...milestones].sort((a, b) =>
    (a.starts_on ?? "9999-12-31").localeCompare(b.starts_on ?? "9999-12-31"),
  );
  const [milestoneId, setMilestoneId] = useState(
    initialMilestoneId ?? ordered[0]?.id ?? "",
  );
  const milestone = milestones.find((entry) => entry.id === milestoneId);
  const confirm = useConfirm();
  const form = useForm<MilestoneInput>({
    resolver: zodResolver(milestoneInput),
    defaultValues: milestone ? milestoneInput.parse(milestone) : emptyMilestone,
  });
  const tentative = useWatch({ control: form.control, name: "is_tentative" });

  async function selectMilestone(id: string) {
    if (
      form.formState.isDirty &&
      !(await confirm({
        title: "다른 항목을 편집할까요?",
        description: "이 항목의 입력 내용은 저장되지 않아요.",
        confirmLabel: "계속",
        destructive: false,
      }))
    )
      return;

    const entry = milestones.find((row) => row.id === id);
    setMilestoneId(id);
    form.reset(entry ? milestoneInput.parse(entry) : emptyMilestone);
  }

  return (
    <ProjectFormSheet
      form={form}
      title="마일스톤 설정"
      description="프로젝트의 마일스톤을 편집해요."
      odId="prj-milestone-editor"
      onClose={onClose}
      afterSave={afterSave}
      command={(item) => ({
        action: "save_milestone",
        projectId,
        id: milestone?.id,
        item,
      })}
      deletion={
        milestone && {
          command: { action: "delete_milestone", projectId, id: milestone.id },
          onDeleted: () => {
            setMilestoneId("");
            form.reset(emptyMilestone);
          },
          name: milestone.title,
          description: "이 마일스톤을 타임라인에서 삭제해요.",
        }
      }
    >
      <Select
        aria-label="편집할 마일스톤"
        value={milestoneId}
        onChange={(event) => void selectMilestone(event.target.value)}
      >
        {ordered.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.title}
          </option>
        ))}
        <option value="">+ 마일스톤 추가</option>
      </Select>
      <Field
        name="title"
        label="마일스톤 제목"
        inputProps={{ maxLength: 100 }}
      />
      <Field
        name="area_id"
        label="소속 영역"
        type="select"
        inputProps={{ variant: "default" }}
        noneLabel="영역 없음"
        options={areas.map((entry) => ({
          value: entry.id,
          label: entry.name,
        }))}
      />
      <Field
        name="is_tentative"
        label="날짜 미정"
        render={({ value, onChange, ...field }) => (
          <Switch
            {...field}
            checked={value}
            onCheckedChange={(checked) => {
              onChange(checked);
              if (checked) {
                form.setValue("starts_on", null, { shouldDirty: true });
                form.setValue("ends_on", null, { shouldDirty: true });
                form.clearErrors(["starts_on", "ends_on"]);
              }
            }}
          />
        )}
      />
      {!tentative && (
        <div className={projectFormFieldStyles({ columns: 2 })}>
          <Field
            name="starts_on"
            label="시작일"
            render={(field) => <ProjectDateControl {...field} label="시작일" />}
          />
          <Field
            name="ends_on"
            label="종료일"
            render={(field) => <ProjectDateControl {...field} label="종료일" />}
          />
        </div>
      )}
      <Field
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default MilestoneEditor;
