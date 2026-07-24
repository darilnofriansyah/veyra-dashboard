import { createFixtureBudgets, createFixtureTransactions, fixtureCategories } from "./fixtures.ts";
import { validateOverviewInput, type Budget, type Transaction } from "./finance.ts";

export type DemoState = "empty" | "budget-error" | "transaction-error" | "error";
type DataResult<T> = { data: T | null; error: boolean };

export type OverviewLoaderResult = {
  transactions: DataResult<Transaction[]>;
  budgets: DataResult<Budget[]>;
  knownCategories: string[];
};

type OverviewSources = {
  transactions: (now: string) => Transaction[];
  budgets: () => Budget[];
};

const fixtureSources: OverviewSources = {
  transactions: createFixtureTransactions,
  budgets: createFixtureBudgets
};

const result = <T,>(settled: PromiseSettledResult<T>): DataResult<T> => settled.status === "fulfilled"
  ? { data: settled.value, error: false }
  : { data: null, error: true };

export async function loadOverview(now: string, requestedState: DemoState | null, sources = fixtureSources): Promise<OverviewLoaderResult> {
  const state = process.env.NODE_ENV === "development" ? requestedState : null;
  const [transactions, budgets] = await Promise.allSettled([
    Promise.resolve().then(() => {
      if (state === "transaction-error" || state === "error") throw new Error("Transaction fixture failure");
      const data = state === "empty" ? [] : sources.transactions(now);
      validateOverviewInput({ transactions: data, budgets: [], period: "current", now });
      return data;
    }),
    Promise.resolve().then(() => {
      if (state === "budget-error" || state === "error") throw new Error("Budget fixture failure");
      const data = sources.budgets();
      validateOverviewInput({ transactions: [], budgets: data, period: "current", now });
      return data;
    })
  ]);

  return {
    transactions: result(transactions),
    budgets: result(budgets),
    knownCategories: fixtureCategories
  };
}
