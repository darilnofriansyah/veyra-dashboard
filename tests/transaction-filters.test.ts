import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTransactionFilters,
  transactionHref
} from "../src/lib/transaction-filters.ts";

const filtersWithCursor = {
  cycle: "current" as const,
  category: "Dining",
  type: "expense" as const,
  search: null,
  cursor: "cursor-1",
  direction: "next" as const
};

test("normalizes supported filters and drops arrays or unknown values", () => {
  assert.deepEqual(parseTransactionFilters({
    cycle: "current",
    category: " Dining ",
    type: "expense",
    search: " tuku ",
    cursor: "cursor-1",
    direction: "next",
    ignored: "value",
    repeated: ["one", "two"]
  }), {
    cycle: "current",
    category: "Dining",
    type: "expense",
    search: "tuku",
    cursor: "cursor-1",
    direction: "next"
  });
});

test("changing a filter clears cursor state", () => {
  const href = transactionHref(filtersWithCursor, { category: "Groceries" });
  assert.equal(href, "/transactions?cycle=current&category=Groceries&type=expense");
});

test("removing one chip preserves the other filters", () => {
  assert.equal(
    transactionHref(filtersWithCursor, { category: null }),
    "/transactions?cycle=current&type=expense"
  );
});

test("drops a direction that has no cursor", () => {
  assert.deepEqual(parseTransactionFilters({ direction: "previous" }), {
    cycle: null,
    category: null,
    type: null,
    search: null,
    cursor: null,
    direction: null
  });
});

test("drops filter text and cursors beyond their limits", () => {
  assert.deepEqual(parseTransactionFilters({
    category: "a".repeat(201),
    search: "b".repeat(201),
    cursor: "c".repeat(513),
    direction: "next"
  }), {
    cycle: null,
    category: null,
    type: null,
    search: null,
    cursor: null,
    direction: null
  });
});

test("creates canonical encoded hrefs in filter order", () => {
  assert.equal(transactionHref({
    cycle: "previous",
    category: "Food & Dining",
    type: "income",
    search: "tuku coffee",
    cursor: "opaque/1",
    direction: "previous"
  }, {}), "/transactions?cycle=previous&category=Food+%26+Dining&type=income&search=tuku+coffee&cursor=opaque%2F1&direction=previous");
});
