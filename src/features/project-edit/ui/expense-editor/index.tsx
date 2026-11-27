"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  budgetLimitInput,
  expenseInput,
  type ExpenseInput,
  type ProjectArea,
  type ProjectExpense,
  type ProjectMember,
} from "@/entities/project";
import { FormField, GroupLabel } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";

type BudgetLimit = { budget_limit: number | null };
const ExpenseField = FormField<ExpenseInput>;
const LimitField = FormField<BudgetLimit>;

const amountProps = {
  type: "number" as const,
  inputProps: {
    min: 0,
    step: 1,
    max: Number.MAX_SAFE_INTEGER,
    className: "text-left!",
  },
  format: (amount: number | null) => amount ?? NaN,
  parse: (amount: number) => (Number.isNaN(amount) ? null : amount),
};
const emptyExpense: ExpenseInput = {
  title: "",
  area_id: null,
  estimated_amount: null,
  planned_on: null,
  actual_amount: null,
  paid_on: null,
  payer_id: null,
  links: [],
  memo: "",
};

export function BudgetLimitEditor({
  projectId,
  limit,
  onClose,
}: {
  projectId: string;
  limit: number | null;
  onClose: () => void;
}) {
  const form = useForm<BudgetLimit>({
    resolver: zodResolver(budgetLimitInput),
    defaultValues: { budget_limit: limit },
  });
  return (
    <ProjectFormSheet
      title="예산 설정"
      odId="prj-budget-limit-editor"
      form={form}
      onClose={onClose}
      command={(item) => ({ action: "set_budget_limit", projectId, ...item })}
    >
      <LimitField
        name="budget_limit"
        label="예산 상한 (원)"
        {...amountProps}
        inputProps={{
          ...amountProps.inputProps,
          placeholder: "비워 두면 상한 없음",
        }}
      />
    </ProjectFormSheet>
  );
}

function ExpenseEditor({
  projectId,
  areas,
  members,
  expense,
  onClose,
}: {
  projectId: string;
  areas: ProjectArea[];
  members: ProjectMember[];
  expense?: ProjectExpense;
  onClose: () => void;
}) {
  const payerMissing =
    expense?.payer_id === null && expense.actual_amount !== null;
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInput(payerMissing)),
    defaultValues: expense ?? emptyExpense,
  });
  const paid =
    useWatch({ control: form.control, name: "actual_amount" }) !== null;
  const paidOnLabel = paid ? "결제일 (필수)" : "결제일";

  return (
    <ProjectFormSheet
      title={expense ? "지출" : "새 지출"}
      odId="prj-expense-editor"
      form={form}
      onClose={onClose}
      command={(item) => ({
        action: "save_expense",
        projectId,
        id: expense?.id,
        item,
      })}
      deletion={
        expense && {
          command: { action: "delete_expense", projectId, id: expense.id },
          name: expense.title,
          description: "프로젝트에서 이 지출을 삭제해요.",
          blockLabel: "지출 삭제",
        }
      }
    >
      <ExpenseField
        name="title"
        label="제목"
        inputProps={{ maxLength: 100, className: "text-left!" }}
      />
      <ExpenseField
        name="area_id"
        label="영역"
        type="select"
        inputProps={{ variant: "default" }}
        noneLabel="영역 없음"
        options={areas.map(({ id, name }) => ({ value: id, label: name }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <GroupLabel className="col-span-2 pt-1 pb-0">예상</GroupLabel>
        <ExpenseField
          name="estimated_amount"
          label="예상액 (원)"
          {...amountProps}
        />
        <ExpenseField
          name="planned_on"
          label="예상 결제일"
          render={(field) => (
            <ProjectDateControl {...field} label="예상 결제일" />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <GroupLabel className="col-span-2 pt-1 pb-0">실제</GroupLabel>
        <ExpenseField
          name="actual_amount"
          label="실제액 (원)"
          {...amountProps}
        />
        <ExpenseField
          name="paid_on"
          label={paidOnLabel}
          render={(field) => (
            <ProjectDateControl {...field} label={paidOnLabel} />
          )}
        />
      </div>
      <ExpenseField
        name="payer_id"
        label={paid && !payerMissing ? "결제자 (필수)" : "결제자"}
        type="select"
        inputProps={{ variant: "default" }}
        noneLabel={payerMissing ? "탈퇴한 구성원" : "결제자 미정"}
        options={members.map(({ user_id, display_name }) => ({
          value: user_id,
          label: display_name,
        }))}
      />
      <ExpenseField
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
      <ExpenseField
        name="links"
        label="링크"
        type="textarea"
        inputProps={{ rows: 2 }}
        format={(links) => links.join("\n")}
        parse={(text) => text.split("\n")}
        hint="링크가 여러 개면 줄을 나눠 입력해 주세요."
      />
    </ProjectFormSheet>
  );
}

export default ExpenseEditor;
