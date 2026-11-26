import { describe, expect, it, vi } from "vitest";
import type { ProjectExpense } from "../api/type";
import { projectBudget } from "./budget.utils";
import { projectExpenseDate } from "./project-date.utils";
import { expenseInput } from "./project.schema";

const first = "2fc2341a-62cb-4b1a-8bdc-de35bbd2e0fa";
const second = "b463c51f-aa63-4c7b-94cf-f910b4f8ed42";
const expense: ProjectExpense = {
  id: first,
  project_id: second,
  area_id: null,
  title: "예약금",
  estimated_amount: 30_000,
  planned_on: "2026-11-30",
  actual_amount: 40_000,
  paid_on: "2026-12-01",
  payer_id: first,
  links: [],
  memo: "",
};

describe("PRJ-10 예산·지출", () => {
  it("예상과 실제를 각 결제 월에 집계하고 상한 대비를 계산한다", () => {
    expect(projectBudget([{ ...expense, payer_id: null }], 100_000)).toEqual({
      estimated: BigInt(30_000),
      actual: BigInt(40_000),
      remaining: BigInt(0),
      percent: 40,
      monthly: [
        { month: "2026-11", estimated: BigInt(30_000), actual: BigInt(0) },
        { month: "2026-12", estimated: BigInt(0), actual: BigInt(40_000) },
      ],
    });
  });

  it("남은 예상에 결제 예정 금액만 합산한다", () => {
    const planned = {
      ...expense,
      estimated_amount: 20_000,
      actual_amount: null,
    };
    const paidAtZero = { ...expense, actual_amount: 0 };
    expect(projectBudget([planned, paidAtZero], null).remaining).toBe(
      BigInt(20_000),
    );
  });

  it("실제액이 0원이어도 실제 결제일과 결제자가 필요하다", () => {
    const result = expenseInput().safeParse({
      ...expense,
      actual_amount: 0,
      paid_on: null,
      payer_id: null,
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "paid_on",
      "payer_id",
    ]);
    expect(
      expenseInput().safeParse({ ...expense, actual_amount: 0 }).success,
    ).toBe(true);
  });

  it("탈퇴한 결제자는 비워 둘 수 있지만 실제 결제일은 필요하다", () => {
    const departed = { ...expense, payer_id: null };
    expect(expenseInput(true).safeParse(departed).success).toBe(true);
    expect(
      expenseInput(true).safeParse({ ...departed, paid_on: null }).success,
    ).toBe(false);
  });
});

it("한국 시간 새해부터 해당 연도의 결제일을 월과 일로 표시한다", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-12-31T15:00:00Z"));
    expect(projectExpenseDate("2027-01-15")).toBe("01.15");
    expect(projectExpenseDate("2026-12-31")).toBe("2026.12.31");
  } finally {
    vi.useRealTimers();
  }
});
