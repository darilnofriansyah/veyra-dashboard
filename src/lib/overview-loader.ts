import { createFixtureBudgets, createFixtureTransactions, fixtureCategories } from "./fixtures.ts";
import type { Budget, Transaction } from "./finance";

export type DemoState = "empty" | "budget-error" | "transaction-error" | "error";
type DataResult<T> = { data: T | null; error: boolean };

export type OverviewLoaderResult = {
  transactions: DataResult<Transaction[]>;
  budgets: DataResult<Budget[]>;
  knownCategories: string[];
};

const result = <T,>(settled: PromiseSettledResult<T>): DataResult<T> => settled.status === "fulfilled"
  ? { data: settled.value, error: false }
  : { data: null, error: true };

export async function loadOverview(now: string, requestedState: DemoState | null): Promise<OverviewLoaderResult> {
  const state = process.env.NODE_ENV === "development" ? requestedState : null;
  const [transactions, budgets] = await Promise.allSettled([
    Promise.resolve().then(() => {
      if (state === "transaction-error" || state === "error") throw new Error("Transaction fixture failure");
      return state === "empty" ? [] : createFixtureTransactions(now);
    }),
    Promise.resolve().then(() => {
      if (state === "budget-error" || state === "error") throw new Error("Budget fixture failure");
      return createFixtureBudgets();
    })
  ]);

  return {
    transactions: result(transactions),
    budgets: result(budgets),
    knownCategories: fixtureCategories
  };
}
