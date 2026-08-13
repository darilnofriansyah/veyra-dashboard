import assert from "node:assert/strict";
import test from "node:test";
import { transactionResultAnnouncement } from "../src/lib/transaction-result-announcement.ts";

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
