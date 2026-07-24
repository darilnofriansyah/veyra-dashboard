import test from "node:test";
import assert from "node:assert/strict";
import { formatIdr, summarizeOverview, validateOverviewInput } from "../src/lib/finance.ts";

const transactions = [
  { id: "jul-income", date: "2026-07-01", merchant: "Salary", category: "Income", amount: 15_600_000, type: "income" as const },
  { id: "jul-food", date: "2026-07-05", merchant: "Grocer", category: "Food & Dining", amount: 1_800_000, type: "expense" as const },
  { id: "jul-ride", date: "2026-07-20", merchant: "Grab", category: "Transport", amount: 600_000, type: "expense" as const },
  { id: "jun-income", date: "2026-06-01", merchant: "Salary", category: "Income", amount: 14_000_000, type: "income" as const },
  { id: "jun-food", date: "2026-06-05", merchant: "Grocer", category: "Food & Dining", amount: 2_000_000, type: "expense" as const },
  { id: "jun-ride", date: "2026-06-20", merchant: "Grab", category: "Transport", amount: 800_000, type: "expense" as const }
];
const budgets = [
  { category: "Food & Dining", limit: 2_200_000 },
  { category: "Transport", limit: 1_000_000 }
];

test("formats IDR using Indonesian grouping", () => {
  assert.match(formatIdr(8_247_300), /^IDR\s8\.247\.300$/);
});

test("calculates one consistent current-month summary", () => {
  const result = summarizeOverview({ transactions, budgets, period: "current", now: "2026-07-24" });
  assert.equal(result.totalIncome, 15_600_000);
  assert.equal(result.totalSpent, 2_400_000);
  assert.equal(result.netCashflow, 13_200_000);
  assert.equal(result.dailyAverage, 100_000);
  assert.equal(result.budgets[0].percent, 82);
  assert.equal(result.alert?.category, "Food & Dining");
  assert.equal(result.comparison.totalSpent, 2_800_000);
});

test("uses full calendar days for a completed month", () => {
  const result = summarizeOverview({ transactions, budgets, period: "previous", now: "2026-07-24" });
  assert.equal(result.dailyAverage, Math.round(2_800_000 / 30));
});

test("rejects duplicate ids, invalid dates, and unsafe amounts", () => {
  assert.throws(
    () => validateOverviewInput({ transactions: [transactions[0], transactions[0]], budgets, period: "current", now: "2026-07-24" }),
    /duplicate transaction id/i
  );
  assert.throws(
    () => validateOverviewInput({ transactions: [{ ...transactions[0], id: "bad", date: "2026-02-31" }], budgets, period: "current", now: "2026-07-24" }),
    /invalid transaction date/i
  );
  assert.throws(
    () => validateOverviewInput({ transactions: [{ ...transactions[0], amount: -1 }], budgets, period: "current", now: "2026-07-24" }),
    /whole non-negative rupiah/i
  );
});
