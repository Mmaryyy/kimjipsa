"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  areaInput,
  type AreaInput,
  type ProjectArea,
} from "@/entities/project";
import { FormField } from "@/shared/ui";
import ProjectFormSheet from "../project-form-sheet";

const Field = FormField<AreaInput>;

function AreaEditor({
  projectId,
  area,
  onClose,
}: {
  projectId: string;
  area?: ProjectArea;
  onClose: () => void;
}) {
  const form = useForm<AreaInput>({
    resolver: zodResolver(areaInput),
    defaultValues: { name: area?.name ?? "" },
  });

  return (
    <ProjectFormSheet
      form={form}
      title={area ? "영역 수정" : "새 영역"}
      description="프로젝트의 영역 이름을 정해요."
      odId="prj-area-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_area",
        projectId,
        id: area?.id,
        item,
      })}
      deletion={
        area && {
          command: { action: "delete_area", projectId, id: area.id },
          name: area.name,
          description: "소속 할 일과 마일스톤은 영역 없음으로 남아요.",
        }
      }
    >
      <Field name="name" label="영역 이름" inputProps={{ maxLength: 100 }} />
    </ProjectFormSheet>
  );
}

export default AreaEditor;
