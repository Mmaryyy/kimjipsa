import type { ProjectExpense } from "../api/type";
const zero = BigInt(0);

export function projectBudget(
  expenses: ProjectExpense[],
  limit: number | null,
) {
  let estimated = zero;
  let actual = zero;
  let remaining = zero;
  const monthly = new Map<string, { estimated: bigint; actual: bigint }>();

  function addMonth(
    date: string | null,
    amount: bigint,
    kind: "estimated" | "actual",
  ) {
    const month = date?.slice(0, 7) ?? "";
    const row = monthly.get(month) ?? { estimated: zero, actual: zero };
    row[kind] += amount;
    monthly.set(month, row);
  }

  for (const expense of expenses) {
    if (expense.estimated_amount !== null) {
      const amount = BigInt(expense.estimated_amount);
      estimated += amount;
      if (expense.actual_amount === null) remaining += amount;
      addMonth(expense.planned_on, amount, "estimated");
    }
    if (expense.actual_amount !== null) {
      const amount = BigInt(expense.actual_amount);
      actual += amount;
      addMonth(expense.paid_on, amount, "actual");
    }
  }
  return {
    estimated,
    actual,
    remaining,
    percent: limit ? (Number(actual) / limit) * 100 : null,
    monthly: [...monthly]
      .sort(([a], [b]) => (a || "9999-99").localeCompare(b || "9999-99"))
      .map(([month, row]) => ({ month, ...row })),
  };
}
