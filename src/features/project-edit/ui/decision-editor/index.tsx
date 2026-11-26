"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  decisionInput,
  decisionOpinionInput,
  decisionStatusLabels,
  decisionStatuses,
  type DecisionInput,
  type ProjectDecision,
} from "@/entities/project";
import { FormField } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";

const decisionFields = decisionInput.omit({ opinions: true });
type DecisionFields = Omit<DecisionInput, "opinions">;
const Field = FormField<DecisionFields>;
const emptyDecision: DecisionFields = {
  question: "",
  status: "discussing",
  due_on: null,
  options: "",
  final_choice: "",
};

function DecisionEditor({
  projectId,
  decision,
  onClose,
}: {
  projectId: string;
  decision?: ProjectDecision;
  onClose: () => void;
}) {
  const form = useForm<DecisionFields>({
    resolver: zodResolver(decisionFields),
    defaultValues: decision
      ? {
          question: decision.question,
          status: decision.status,
          due_on: decision.due_on,
          options: decision.options,
          final_choice: decision.final_choice,
        }
      : emptyDecision,
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
        item: { ...item, opinions: [] },
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
        label="후보 (줄마다 하나)"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
      <Field
        name="final_choice"
        label="최종 선택"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export function DecisionOpinionEditor({
  decision,
  opinion,
  onClose,
}: {
  decision: ProjectDecision;
  opinion: string;
  onClose: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(decisionOpinionInput),
    defaultValues: { opinion },
  });
  return (
    <ProjectFormSheet
      form={form}
      title="내 의견"
      odId="prj-decision-opinion-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_decision_opinion",
        projectId: decision.project_id,
        id: decision.id,
        item,
      })}
    >
      <p className="font-semibold wrap-anywhere">{decision.question}</p>
      <FormField<{ opinion: string }>
        name="opinion"
        label="의견"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default DecisionEditor;
