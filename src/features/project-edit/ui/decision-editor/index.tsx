"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  decisionInput,
  decisionStatusLabels,
  decisionStatuses,
  type DecisionInput,
  type ProjectDecision,
  type ProjectMember,
} from "@/entities/project";
import { FormField } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";

const Field = FormField<DecisionInput>;
const emptyDecision: DecisionInput = {
  question: "",
  status: "discussing",
  due_on: null,
  options: "",
  final_choice: "",
  opinions: [],
};

function DecisionEditor({
  projectId,
  members: currentMembers,
  decision,
  onClose,
}: {
  projectId: string;
  members: ProjectMember[];
  decision?: ProjectDecision;
  onClose: () => void;
}) {
  const [members] = useState(() => currentMembers);
  const opinions = members.map(({ user_id }) => ({
    user_id,
    opinion:
      decision?.opinions.find((row) => row.user_id === user_id)?.opinion ?? "",
  }));
  const form = useForm<DecisionInput>({
    resolver: zodResolver(decisionInput),
    defaultValues: { ...(decision ?? emptyDecision), opinions },
  });

  return (
    <ProjectFormSheet
      form={form}
      title={decision ? "결정 수정" : "결정 추가"}
      odId="prj-decision-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_decision",
        projectId,
        id: decision?.id,
        item: {
          ...item,
          opinions: item.opinions.filter(
            (_, index) =>
              form.getFieldState(`opinions.${index}.opinion`).isDirty,
          ),
        },
      })}
      deletion={
        decision && {
          command: { action: "delete_decision", projectId, id: decision.id },
          name: decision.question,
          description: "결정과 구성원 의견을 삭제해요.",
        }
      }
    >
      <Field name="question" label="질문" inputProps={{ maxLength: 100 }} />
      <Field
        name="status"
        label="상태"
        type="select"
        inputProps={{ variant: "default" }}
        options={decisionStatuses.map((value) => ({
          value,
          label: decisionStatusLabels[value],
        }))}
      />
      <Field
        name="due_on"
        label="기한"
        render={(field) => <ProjectDateControl {...field} label="기한" />}
      />
      <Field
        name="options"
        label="후보"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
      {members.map(({ user_id, display_name }, index) => (
        <Field
          key={user_id}
          name={`opinions.${index}.opinion`}
          label={`${display_name} 의견`}
          inputProps={{ maxLength: 1000 }}
        />
      ))}
      <Field
        name="final_choice"
        label="최종 선택"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default DecisionEditor;
