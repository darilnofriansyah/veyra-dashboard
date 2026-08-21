import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTransaction,
  parseTransactionEditForm,
  parseTransactionPageData
} from "../src/lib/transaction-contract.ts";

const expense = {
  id: "123",
  amount: 25_000,
  merchant: "TUKU",
  category: "Dining",
  pocketId: "42",
  pocketName: "Daily spending",
  type: "expense",
  source: "email",
  transactionDate: "2026-08-13T03:00:00.123456Z",
  updatedAt: "2026-08-13T03:01:00.123456Z",
  creditCard: true
};

const income = {
  id: "124",
  amount: 1_000_000,
  merchant: null,
  category: null,
  pocketId: null,
  pocketName: null,
  type: "income",
  source: "manual",
  transactionDate: "2026-08-12T03:00:00.000Z",
  updatedAt: "2026-08-12T03:01:00.000Z",
  creditCard: false
};

test("parses finalized expense responses without changing microsecond timestamps", () => {
  assert.deepEqual(parseTransaction(expense), expense);
});

test("parses an income response with nullable metadata", () => {
  assert.deepEqual(parseTransaction(income), income);
});

test("accepts incomplete legacy expense metadata for display", () => {
  const parsed = parseTransaction({
    ...expense,
    merchant: null,
    category: null,
  });

  assert.equal(parsed.type, "expense");
  assert.equal(parsed.merchant, null);
  assert.equal(parsed.category, null);
});

test("parses a transaction page with nullable cursors", () => {
  assert.deepEqual(parseTransactionPageData({
    items: [expense, income],
    previousCursor: null,
    nextCursor: "opaque-next",
    categories: ["Dining", "Income"]
  }), {
    items: [expense, income],
    previousCursor: null,
    nextCursor: "opaque-next",
    categories: ["Dining", "Income"]
  });
});

test("parses an expense edit into a positive whole-rupiah input", () => {
  const form = new FormData();
  form.set("transactionId", "123");
  form.set("expectedUpdatedAt", "2026-08-13T03:01:00.000Z");
  form.set("type", "expense");
  form.set("amount", "30000");
  form.set("merchant", " Tuku Kemang ");
  form.set("category", " Dining ");
  form.set("pocketId", "");

  assert.deepEqual(parseTransactionEditForm(form), {
    ok: true,
    value: {
      transactionId: "123",
      expectedUpdatedAt: "2026-08-13T03:01:00.000Z",
      amount: 30000,
      merchant: "Tuku Kemang",
      category: "Dining",
      pocketId: null
    }
  });
});

test("rejects fractional, zero, and unsafe edit amounts", () => {
  for (const amount of ["30000.5", "0", "9007199254740992"]) {
    const form = validEditForm();
    form.set("amount", amount);
    const parsed = parseTransactionEditForm(form);

    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.state.fieldErrors.amount, "Enter a positive whole-rupiah amount.");
  }
});

test("rejects duplicate amount values instead of accepting the first one", () => {
  const form = validEditForm();
  form.append("amount", "40000");

  assert.deepEqual(parseTransactionEditForm(form), {
    ok: false,
    state: {
      status: "validation",
      fieldErrors: { amount: "Enter a positive whole-rupiah amount." }
    }
  });
});

test("requires merchant and category text for expense edits", () => {
  const form = validEditForm();
  form.set("merchant", "   ");
  form.set("category", "");
  const parsed = parseTransactionEditForm(form);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.deepEqual(parsed.state.fieldErrors, {
      merchant: "Merchant is required for expenses.",
      category: "Category is required for expenses."
    });
  }
});

test("normalizes blank income edit metadata to null", () => {
  const form = validEditForm();
  form.set("type", "income");
  form.set("merchant", "  ");
  form.set("category", "");

  assert.deepEqual(parseTransactionEditForm(form), {
    ok: true,
    value: {
      transactionId: "123",
      expectedUpdatedAt: "2026-08-13T03:01:00.000Z",
      amount: 30_000,
      merchant: null,
      category: null,
      pocketId: null
    }
  });
});

test("rejects duplicate or file-valued income metadata", () => {
  const duplicate = validEditForm();
  duplicate.set("type", "income");
  duplicate.append("merchant", "Salary");

  const file = validEditForm();
  file.set("type", "income");
  file.set("merchant", new Blob(["merchant"]), "merchant.txt");

  for (const form of [duplicate, file]) {
    const parsed = parseTransactionEditForm(form);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.ok(parsed.state.fieldErrors.merchant);
  }
});

test("parses an optional pocket edit and rejects malformed values", () => {
  const form = validEditForm();
  form.set("pocketId", " 42 ");

  assert.deepEqual(parseTransactionEditForm(form), {
    ok: true,
    value: {
      transactionId: "123",
      expectedUpdatedAt: "2026-08-13T03:01:00.000Z",
      amount: 30_000,
      merchant: "Tuku Kemang",
      category: "Dining",
      pocketId: "42"
    }
  });

  const invalid = validEditForm();
  invalid.set("pocketId", "pocket-42");
  const parsed = parseTransactionEditForm(invalid);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.state.fieldErrors.pocketId, "Select a valid pocket.");
});

test("rejects a file-valued transaction ID", () => {
  const form = validEditForm();
  form.set("transactionId", new Blob(["123"]), "transaction-id.txt");

  assert.equal(parseTransactionEditForm(form).ok, false);
});

test("rejects malformed optimistic-version timestamps", () => {
  const form = validEditForm();
  form.set("expectedUpdatedAt", "2026-08-13T03:01:00Z");

  const parsed = parseTransactionEditForm(form);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.state.fieldErrors.amount, undefined);
});

test("rejects unsupported response enums", () => {
  assert.throws(() => parseTransaction({ ...expense, type: "transfer" }));
  assert.throws(() => parseTransaction({ ...expense, source: "bank" }));
});

test("rejects malformed response data", () => {
  assert.throws(() => parseTransaction(null));
  assert.throws(() => parseTransaction({ ...expense, transactionDate: "2026-08-13T03:00:00Z" }));
  assert.throws(() => parseTransactionPageData({
    items: [expense],
    previousCursor: "x".repeat(513),
    nextCursor: null,
    categories: ["Dining"]
  }));
  assert.throws(() => parseTransactionPageData({
    items: [expense],
    previousCursor: null,
    nextCursor: null,
    categories: ["Dining", "Dining"]
  }));
});

function validEditForm(): FormData {
  const form = new FormData();
  form.set("transactionId", "123");
  form.set("expectedUpdatedAt", "2026-08-13T03:01:00.000Z");
  form.set("type", "expense");
  form.set("amount", "30000");
  form.set("merchant", "Tuku Kemang");
  form.set("category", "Dining");
  form.set("pocketId", "");
  return form;
}
