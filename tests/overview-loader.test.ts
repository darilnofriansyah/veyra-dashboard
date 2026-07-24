import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("loads transaction and budget fixtures as independent settled results", async () => {
  const source = await readFile("src/lib/overview-loader.ts", "utf8").catch(() => "");
  assert.match(source, /export async function loadOverview/);

  const { loadOverview } = await import("../src/lib/overview-loader.ts");
  const environment = process.env as Record<string, string | undefined>;
  const previousNodeEnv = environment.NODE_ENV;
  environment.NODE_ENV = "development";

  try {
    const loaded = await loadOverview("2026-07-24", null);
    assert.ok(loaded.transactions.data?.length);
    assert.ok(loaded.budgets.data?.length);
    assert.equal(loaded.transactions.error, false);
    assert.equal(loaded.budgets.error, false);

    const transactionError = await loadOverview("2026-07-24", "transaction-error");
    assert.equal(transactionError.transactions.error, true);
    assert.ok(transactionError.budgets.data?.length);

    const budgetError = await loadOverview("2026-07-24", "budget-error");
    assert.ok(budgetError.transactions.data?.length);
    assert.equal(budgetError.budgets.error, true);

    const completeError = await loadOverview("2026-07-24", "error");
    assert.equal(completeError.transactions.error, true);
    assert.equal(completeError.budgets.error, true);

    const empty = await loadOverview("2026-07-24", "empty");
    assert.deepEqual(empty.transactions.data, []);
    assert.ok(empty.budgets.data?.length);
  } finally {
    if (previousNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousNodeEnv;
  }
});
