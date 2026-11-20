"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  taskAssignees,
  taskInput,
  taskStatusLabels,
  taskStatuses,
  type ProjectArea,
  type ProjectMember,
  type ProjectTask,
  type TaskInput,
} from "@/entities/project";
import { FormField, Select } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";
import { projectFormFieldStyles } from "../project-form-sheet/project-form.styles";

const Field = FormField<TaskInput>;
const statuses = taskStatuses.map((value) => ({
  value,
  label: taskStatusLabels[value],
}));

function TaskEditor({
  projectId,
  areas,
  members,
  task,
  onClose,
}: {
  projectId: string;
  areas: ProjectArea[];
  members: ProjectMember[];
  task?: ProjectTask;
  onClose: () => void;
}) {
  const form = useForm<TaskInput>({
    resolver: zodResolver(taskInput),
    defaultValues: task ?? {
      title: "",
      area_id: null,
      assignee_kind: "unassigned",
      assignee_id: null,
      status: "todo",
      starts_on: null,
      due_on: null,
      depends_note: "",
      memo: "",
    },
  });
  const kind = useWatch({ control: form.control, name: "assignee_kind" });

  return (
    <ProjectFormSheet
      form={form}
      title={task ? "할 일 수정" : "할 일 추가"}
      description="프로젝트에서 함께 관리할 할 일이에요."
      odId="prj-task-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_task",
        id: task?.id,
        projectId,
        item,
      })}
      deletion={
        task && {
          command: { action: "delete_task", id: task.id, projectId },
          name: task.title,
          description: "이 할 일을 프로젝트에서 삭제해요.",
        }
      }
    >
      <Field name="title" label="제목" inputProps={{ maxLength: 100 }} />
      <div className={projectFormFieldStyles({ columns: 2 })}>
        <Field
          name="area_id"
          label="영역"
          type="select"
          inputProps={{ variant: "default" }}
          noneLabel="영역 없음"
          options={areas.map((area) => ({ value: area.id, label: area.name }))}
        />
        <Field
          name="assignee_id"
          label="담당"
          render={({ value, onChange, ...field }) => (
            <Select
              {...field}
              value={value ?? kind}
              onChange={(event) => {
                const selected = event.target.value;
                if (selected === "unassigned" || selected === "together") {
                  form.setValue("assignee_kind", selected, {
                    shouldDirty: true,
                  });
                  onChange(null);
                } else {
                  form.setValue("assignee_kind", "member", {
                    shouldDirty: true,
                  });
                  onChange(selected);
                }
              }}
            >
              {taskAssignees(members).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        />
      </div>
      <Field
        name="status"
        label="상태"
        type="select"
        options={statuses}
        inputProps={{ variant: "default" }}
      />
      <div className={projectFormFieldStyles({ columns: 2 })}>
        <Field
          name="starts_on"
          label="시작일"
          render={(field) => <ProjectDateControl {...field} label="시작일" />}
        />
        <Field
          name="due_on"
          label="마감일"
          render={(field) => <ProjectDateControl {...field} label="마감일" />}
        />
      </div>
      <Field
        name="depends_note"
        label="선행 조건"
        inputProps={{ maxLength: 1000 }}
      />
      <Field
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default TaskEditor;
