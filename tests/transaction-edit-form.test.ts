import assert from "node:assert/strict";
import test from "node:test";
import {
  editableAmount,
  transactionEditIsDirty
} from "../src/lib/transaction-edit-form.ts";

test("accepts only positive safe whole-rupiah amount strings", () => {
  assert.equal(editableAmount("25000"), 25_000);
  for (const value of ["", "0", "-1", "1.5", "1e3", "025000", "9007199254740992"]) {
    assert.equal(editableAmount(value), null, value);
  }
});

test("detects material edits using server-compatible normalization", () => {
  const transaction = {
    amount: 25_000,
    merchant: "TUKU",
    category: "Dining",
    pocketId: "42"
  };

  assert.equal(transactionEditIsDirty(transaction, "25000", " TUKU ", "Dining", "42"), false);
  assert.equal(transactionEditIsDirty(transaction, "30000", "TUKU", "Dining", "42"), true);
  assert.equal(transactionEditIsDirty(transaction, "25000", "Tuku Kemang", "Dining", "42"), true);
  assert.equal(transactionEditIsDirty(transaction, "25000", "TUKU", "Coffee", "42"), true);
  assert.equal(transactionEditIsDirty(transaction, "25000", "TUKU", "Dining", ""), true);
  assert.equal(transactionEditIsDirty(transaction, "1e3", "TUKU", "Dining", "42"), true);
});

test("treats blank and null income metadata as unchanged", () => {
  const transaction = { amount: 1_000_000, merchant: null, category: null, pocketId: null };

  assert.equal(transactionEditIsDirty(transaction, "1000000", "  ", "", ""), false);
});
