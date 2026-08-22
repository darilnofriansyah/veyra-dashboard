import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreatePocketForm,
  parseDefaultPocketForm,
  parsePocket,
  parsePocketBudgetForm,
  parseRenamePocketForm
} from "../src/lib/pocket-contract.ts";

function form(values: Record<string, string>): FormData {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

test("parses a valid create pocket form", () => {
  assert.deepEqual(parseCreatePocketForm(form({ name: "  Daily spending  " })), {
    ok: true,
    value: { name: "Daily spending" }
  });
});

test("rejects duplicate create values", () => {
  const value = form({ name: "Daily spending" });
  value.append("name", "Other");
  assert.deepEqual(parseCreatePocketForm(value), {
    ok: false,
    state: { status: "validation", fieldErrors: { name: "Enter a pocket name." } }
  });
});

test("parses valid rename, budget, and default forms", () => {
  assert.deepEqual(parseRenamePocketForm(form({ pocketId: " 42 ", name: "  Travel " })), {
    ok: true,
    value: { pocketId: "42", name: "Travel" }
  });
  assert.deepEqual(parsePocketBudgetForm(form({ pocketId: "42", amount: "30000" })), {
    ok: true,
    value: { pocketId: "42", amount: 30000 }
  });
  assert.deepEqual(parseDefaultPocketForm(form({ pocketId: "42" })), {
    ok: true,
    value: { pocketId: "42" }
  });
});

test("rejects zero, fractional, and unsafe amounts", () => {
  for (const amount of ["0", "30000.5", "9007199254740992"]) {
    const parsed = parsePocketBudgetForm(form({ pocketId: "42", amount }));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.state.fieldErrors.amount, "Enter a positive whole-rupiah amount.");
  }
});

test("rejects malformed IDs, names, amounts, and defaults", () => {
  const invalidId = parseDefaultPocketForm(form({ pocketId: "pocket-42" }));
  assert.equal(invalidId.ok, false);
  if (!invalidId.ok) assert.equal(invalidId.state.fieldErrors.pocketId, "Select a valid pocket.");

  for (const name of ["", "   ", "x".repeat(201)]) {
    const parsed = parseCreatePocketForm(form({ name }));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.ok(parsed.state.fieldErrors.name);
  }

  assert.equal(parsePocketBudgetForm(form({ pocketId: "42" })).ok, false);
  assert.equal(parseDefaultPocketForm(new FormData()).ok, false);
  assert.throws(() => parsePocket(null));
  assert.throws(() => parsePocket({ id: "0", name: "Pocket", amount: null, isDefault: false }));
  assert.throws(() => parsePocket({ id: "42", name: "Pocket", amount: -1, isDefault: false }));
  assert.throws(() => parsePocket({ id: "42", name: "Pocket", amount: 1, isDefault: "no" }));
});

test("parses a valid pocket response", () => {
  assert.deepEqual(parsePocket({ id: "42", name: "Pocket", amount: 0, isDefault: true }), {
    id: "42",
    name: "Pocket",
    amount: 0,
    isDefault: true
  });
});
