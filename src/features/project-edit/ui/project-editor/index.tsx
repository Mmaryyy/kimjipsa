"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  projectInput,
  projectModuleLabels,
  projectModules,
  projectStatusLabels,
  projectStatuses,
  type Project,
  type ProjectInput,
} from "@/entities/project";
import { Checkbox, FormField } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";
import { projectFormFieldStyles } from "../project-form-sheet/project-form.styles";

const Field = FormField<ProjectInput>;
const statuses = projectStatuses.map((value) => ({
  value,
  label: projectStatusLabels[value],
}));

function ProjectEditor({
  project,
  onClose,
  savedPath,
  deletedPath,
}: {
  project?: Project;
  onClose: () => void;
  savedPath?: (id: string) => string;
  deletedPath?: string;
}) {
  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectInput),
    defaultValues: project ?? {
      title: "",
      description: "",
      starts_on: null,
      target_on: null,
      status: "active",
      modules: [...projectModules],
    },
  });
  const modules = useWatch({ control: form.control, name: "modules" });
  const deletion = project
    ? {
        command: { action: "delete_project" as const, id: project.id },
        name: project.title,
        description: `${project.title} 프로젝트와 안의 항목이 삭제돼요. 되돌릴 수 없어요.`,
        deletedPath,
      }
    : undefined;

  return (
    <ProjectFormSheet
      form={form}
      title={project ? "프로젝트 설정" : "새 프로젝트"}
      odId={project ? "prj-project-settings" : "prj-create"}
      submitLabel={project ? "저장" : "만들기"}
      onClose={onClose}
      savedPath={savedPath}
      deletion={deletion}
      command={(item) => ({ action: "save_project", id: project?.id, item })}
    >
      <Field
        name="title"
        label="프로젝트 이름 (필수)"
        inputProps={{ maxLength: 100, placeholder: "예: 이사 준비" }}
      />
      <Field
        name="description"
        label="설명"
        type="textarea"
        inputProps={{ maxLength: 1000, placeholder: "무엇을 함께 준비하나요?" }}
      />
      <div className={projectFormFieldStyles({ columns: 2 })}>
        <Field
          name="starts_on"
          label="시작일"
          render={(field) => <ProjectDateControl {...field} label="시작일" />}
        />
        <Field
          name="target_on"
          label="목표일"
          render={(field) => <ProjectDateControl {...field} label="목표일" />}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="font-semibold">구성 요소</legend>
        <p className="text-sm text-muted-foreground">
          할 일·마일스톤은 항상 켜져 있어요.
        </p>
        <div className="grid">
          {projectModules.map((module) => (
            <label
              key={module}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <Checkbox
                checked={modules.includes(module)}
                onCheckedChange={(checked) => {
                  const next = projectModules.filter((value) =>
                    value === module
                      ? checked === true
                      : modules.includes(value),
                  );
                  form.setValue("modules", next, { shouldDirty: true });
                }}
              />
              {projectModuleLabels[module]}
            </label>
          ))}
        </div>
        {project && (
          <p className="text-sm text-muted-foreground">
            구성 요소를 끄면 숨겨져요. 다시 켜면 기존 데이터가 보여요.
          </p>
        )}
      </fieldset>
      {project && (
        <Field
          name="status"
          label="상태"
          type="select"
          options={statuses}
          inputProps={{ variant: "default" }}
        />
      )}
    </ProjectFormSheet>
  );
}

export default ProjectEditor;
