import assert from "node:assert/strict";
import test from "node:test";
import {
  transactionResultAnnouncement,
  transactionResultAnnouncementModel
} from "../src/lib/transaction-result-announcement.ts";

const baseFilters = {
  cycle: null,
  category: null,
  type: null,
  search: null,
  cursor: null,
  direction: null
} as const;

test("announces every transaction result state without reading table contents", () => {
  assert.equal(
    transactionResultAnnouncement({ data: { items: [{}, {}, {}] }, error: false }, false),
    "3 transactions loaded on this page."
  );
  assert.equal(
    transactionResultAnnouncement({ data: { items: [{}] }, error: false }, false),
    "1 transaction loaded on this page."
  );
  assert.equal(
    transactionResultAnnouncement({ data: { items: [] }, error: false }, true),
    "No finalized transactions match these filters."
  );
  assert.equal(
    transactionResultAnnouncement({ data: { items: [] }, error: false }, false),
    "No finalized transactions yet."
  );
  assert.equal(
    transactionResultAnnouncement({ data: null, error: true }, true),
    "Transactions couldn’t be loaded."
  );
});

test("synchronously keys filter and cursor transitions while speaking only current context", () => {
  const result = { data: { items: Array.from({ length: 50 }, () => ({})) }, error: false };
  const dining = transactionResultAnnouncementModel(result, { ...baseFilters, category: "Dining" });
  const groceries = transactionResultAnnouncementModel(result, { ...baseFilters, category: "Groceries" });

  assert.notEqual(dining.key, groceries.key);
  assert.notEqual(dining.message, groceries.message);
  assert.match(dining.message, /Dining/);
  assert.match(groceries.message, /Groceries/);

  const firstOpaqueCursor = "opaque-secret-page-one";
  const secondOpaqueCursor = "opaque-secret-page-two";
  const nextPage = transactionResultAnnouncementModel(result, {
    ...baseFilters,
    cursor: firstOpaqueCursor,
    direction: "next"
  });
  const followingPage = transactionResultAnnouncementModel(result, {
    ...baseFilters,
    cursor: secondOpaqueCursor,
    direction: "next"
  });

  assert.notEqual(nextPage.key, followingPage.key);
  assert.equal(nextPage.message, followingPage.message);
  assert.match(nextPage.message, /Next result page/);
  assert.doesNotMatch(nextPage.message, new RegExp(firstOpaqueCursor));
  assert.doesNotMatch(followingPage.message, new RegExp(secondOpaqueCursor));

  const current = transactionResultAnnouncementModel(
    { data: { items: [{}, {}] }, error: false },
    { ...baseFilters, category: "Groceries" }
  );
  assert.match(current.message, /^2 transactions loaded on this page\. Filters: category Groceries\./);
  assert.doesNotMatch(current.message, /50|Dining/);
});
