import assert from "node:assert/strict";
import test from "node:test";
import { parseTimelinePage } from "../src/lib/transaction-timeline-contract.ts";

const transaction = {
  id: "123",
  amount: 25_000,
  merchant: "TUKU",
  category: "Dining",
  pocketId: "42",
  pocketName: "Daily spending",
  type: "expense",
  source: "email",
  transactionDate: "2026-09-18T03:00:00.123456Z",
  updatedAt: "2026-09-18T03:01:00.123456Z",
  creditCard: true
};

const installment = {
  kind: "installment",
  entryId: "installment:7",
  planId: "2",
  originalTransactionId: "123",
  sequence: 1,
  tenorMonths: 6,
  dueDate: "2026-09-30",
  merchant: "Electronics",
  category: "Shopping",
  pocketId: null,
  principal: 1_000_000,
  interest: 60_000,
  total: 1_060_000,
  budgetAmount: 0,
  scheduledBudgetAmount: 60_000,
  state: "scheduled",
  interestPostingPending: false
};

test("parses ordinary and installment entries as distinct discriminants", () => {
  const page = parseTimelinePage({
    items: [
      { kind: "transaction", entryId: "transaction:123", transaction, hasInstallmentPlan: true, budgetAmount: 25_000 },
      installment
    ],
    previousCursor: null,
    nextCursor: null,
    categories: ["Dining", "Shopping"]
  });

  assert.equal(page.items[0]?.kind, "transaction");
  assert.equal(page.items[1]?.kind, "installment");
});

test("rejects invalid discriminants, date-only values, IDs, and unsafe money", () => {
  const base = {
    items: [installment],
    previousCursor: null,
    nextCursor: null,
    categories: ["Shopping"]
  };
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, kind: "transaction" }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, dueDate: "2026-02-30" }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, planId: "0" }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, interest: Number.MAX_SAFE_INTEGER + 1 }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, merchant: " " }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, budgetAmount: 60_000 }] }));
  assert.throws(() => parseTimelinePage({ ...base, items: [{ ...installment, state: "due" }] }));
});
