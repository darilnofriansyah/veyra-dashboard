import assert from "node:assert/strict";
import test from "node:test";
import {
  navigationAwareTransactionResultAnnouncement,
  nextTransactionAnnouncementNavigation,
  transactionResultAnnouncement
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

test("changes accessible copy for same-count filter and cursor transitions without exposing cursors", () => {
  const result = { data: { items: Array.from({ length: 50 }, () => ({})) }, error: false };
  const initial = nextTransactionAnnouncementNavigation(null, baseFilters);
  assert.equal(nextTransactionAnnouncementNavigation(initial, baseFilters), initial);
  const dining = nextTransactionAnnouncementNavigation(initial, { ...baseFilters, category: "Dining" });
  const groceries = nextTransactionAnnouncementNavigation(dining, { ...baseFilters, category: "Groceries" });
  const diningCopy = navigationAwareTransactionResultAnnouncement(result, dining);
  const groceriesCopy = navigationAwareTransactionResultAnnouncement(result, groceries);

  assert.notEqual(diningCopy, groceriesCopy);
  assert.match(diningCopy, /Dining/);
  assert.match(groceriesCopy, /Groceries/);

  const firstOpaqueCursor = "opaque-secret-page-one";
  const secondOpaqueCursor = "opaque-secret-page-two";
  const nextPage = nextTransactionAnnouncementNavigation(groceries, {
    ...baseFilters,
    cursor: firstOpaqueCursor,
    direction: "next"
  });
  const followingPage = nextTransactionAnnouncementNavigation(nextPage, {
    ...baseFilters,
    cursor: secondOpaqueCursor,
    direction: "next"
  });
  const nextPageCopy = navigationAwareTransactionResultAnnouncement(result, nextPage);
  const followingPageCopy = navigationAwareTransactionResultAnnouncement(result, followingPage);

  assert.notEqual(nextPageCopy, followingPageCopy);
  assert.match(nextPageCopy, /Next result page/);
  assert.match(followingPageCopy, /Next result page/);
  assert.doesNotMatch(nextPageCopy, new RegExp(firstOpaqueCursor));
  assert.doesNotMatch(followingPageCopy, new RegExp(secondOpaqueCursor));
});
