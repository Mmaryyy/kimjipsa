import {
  projectBudget,
  projectDeadlineDays,
  projectExpenseDate,
  projectToday,
  type ProjectDetail,
  type ProjectExpense,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { BudgetLimitEditor, ExpenseEditor } from "@/features/project-edit";
import { cn, formatAmount, type AmountFormat } from "@/shared/lib";
import {
  List,
  ListGroupLabel,
  ListRow,
  SectionHeader,
  Text,
  TextButton,
} from "@/shared/ui";
import ProjectBudgetSummary from "./Summary";

export const budgetLimitEditorId = "budget-limit";

const ExpenseDeadline = ({ days }: { days: number }) => {
  let label = `D-${days}`;
  if (days < 0) label = `${-days}일 지남`;
  else if (days === 0) label = "오늘";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-control bg-sys-gray5 px-2 py-0.5",
        "text-caption font-semibold tabular-nums",
        days >= 0 && days <= 7 && "text-[var(--accent-text)]",
        days === 0 && "bg-[var(--accent-soft)]",
      )}
    >
      {days < 0 && (
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      )}
      {label}
    </span>
  );
};

interface ExpenseRowProps {
  expense: ProjectExpense;
  areas: ProjectDetail["areas"];
  members: ProjectDetail["members"];
  today: string;
  amountFormat: AmountFormat;
  onEdit: () => void;
}

const ExpenseRow = ({
  expense,
  areas,
  members,
  today,
  amountFormat,
  onEdit,
}: ExpenseRowProps) => {
  const paid = expense.actual_amount !== null;
  const area =
    areas.find(({ id }) => id === expense.area_id)?.name ?? "영역 없음";
  const payer = members.find(
    ({ user_id }) => user_id === expense.payer_id,
  )?.display_name;
  const facts = paid ? `${area} · ${payer ?? "탈퇴한 구성원"}` : area;
  const date = paid ? expense.paid_on : expense.planned_on;
  const days = !paid && date ? projectDeadlineDays(date, today) : null;
  const amount = expense.actual_amount ?? expense.estimated_amount;

  return (
    <li>
      <TextButton
        size="row-start"
        tone="neutral"
        className="grid min-h-14 grid-cols-1 gap-0.5 py-2 text-body"
        data-od-id={`prj-expense-${expense.id}`}
        aria-haspopup="dialog"
        onClick={onEdit}
      >
        <span className="flex min-h-[22px] min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{expense.title}</span>
          {days !== null && days <= 14 && <ExpenseDeadline days={days} />}
          <span className="ml-auto shrink-0 text-caption text-muted-foreground tabular-nums">
            {date ? (
              <time dateTime={date}>{projectExpenseDate(date, today)}</time>
            ) : (
              "날짜 미정"
            )}
          </span>
        </span>
        <span className="flex min-h-[22px] min-w-0 items-center justify-between gap-2">
          <span className="truncate text-caption text-muted-foreground">
            {facts}
          </span>
          <span className="shrink-0 font-medium tabular-nums">
            {amount === null ? "—" : formatAmount(amount, amountFormat)}
          </span>
        </span>
      </TextButton>
    </li>
  );
};

interface Props {
  data: ProjectDetail;
  editor?: string;
  setEditor: (id?: string) => void;
}

const ProjectBudget = ({ data, editor, setEditor }: Props) => {
  const { project, expenses, members, areas } = data;
  const { data: account } = useAccount();
  const amountFormat = account?.amountFormat ?? "won";
  const today = projectToday();
  const limit = project.budget_limit;
  const budget = projectBudget(expenses, limit);
  const groups = [
    {
      label: "결제 예정",
      empty: "결제할 지출이 없어요.",
      items: expenses
        .filter(({ actual_amount }) => actual_amount === null)
        .sort((a, b) =>
          (a.planned_on ?? "9").localeCompare(b.planned_on ?? "9"),
        ),
      amount: budget.remaining,
    },
    {
      label: "결제함",
      empty: "아직 결제한 지출이 없어요.",
      items: expenses
        .filter(({ actual_amount }) => actual_amount !== null)
        .sort((a, b) => (b.paid_on ?? "").localeCompare(a.paid_on ?? "")),
      amount: budget.actual,
    },
  ];
  const editing = expenses.find(({ id }) => id === editor);

  return (
    <>
      <ProjectBudgetSummary
        budget={budget}
        limit={limit}
        amountFormat={amountFormat}
        onEditLimit={() => setEditor(budgetLimitEditorId)}
      />
      <section
        aria-labelledby="prj-expenses-title"
        className="mt-6"
        data-od-id="prj-budget-expenses"
      >
        <SectionHeader id="prj-expenses-title" title="지출" />
        <div data-od-id="prj-expense-list">
          {groups.map(({ label, empty, items, amount }) => (
            <div key={label}>
              <ListGroupLabel className="flex items-baseline justify-between gap-2 pt-3">
                <span>
                  {label} · {items.length}건
                </span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {formatAmount(amount, amountFormat)}
                </span>
              </ListGroupLabel>
              {items.length > 0 ? (
                <List variant="divided">
                  {items.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      areas={areas}
                      members={members}
                      today={today}
                      amountFormat={amountFormat}
                      onEdit={() => setEditor(expense.id)}
                    />
                  ))}
                </List>
              ) : (
                <Text as="p" variant="caption">
                  {empty}
                </Text>
              )}
            </div>
          ))}
        </div>
      </section>
      <section
        aria-labelledby="prj-monthly-title"
        className="mt-6"
        data-od-id="prj-budget-monthly"
      >
        <SectionHeader id="prj-monthly-title" title="월별" />
        {budget.monthly.length === 0 && (
          <Text as="p" variant="caption">
            아직 월별 지출이 없어요.
          </Text>
        )}
        <List variant="divided">
          {budget.monthly.map(({ month, estimated, actual }) => (
            <ListRow
              key={month}
              className="min-h-14"
              description={`예상 ${formatAmount(estimated, amountFormat)}`}
              trailing={
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    actual === BigInt(0) && "text-label-tertiary",
                  )}
                >
                  {formatAmount(actual, amountFormat)}
                </span>
              }
            >
              <span className="font-semibold tabular-nums">
                {month ? month.replace("-", ".") : "예상 결제일 미정"}
              </span>
            </ListRow>
          ))}
        </List>
      </section>
      {editor === budgetLimitEditorId && (
        <BudgetLimitEditor
          projectId={project.id}
          limit={limit}
          onClose={() => setEditor()}
        />
      )}
      {(editor === "" || editing) && (
        <ExpenseEditor
          key={editor}
          projectId={project.id}
          members={members}
          areas={areas}
          expense={editing}
          onClose={() => setEditor()}
        />
      )}
    </>
  );
};

export default ProjectBudget;
