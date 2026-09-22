import assert from "node:assert/strict";
import test from "node:test";
import { loadTransactionTimeline } from "../src/lib/transaction-timeline-api.ts";

const page = {
  items: [],
  previousCursor: null,
  nextCursor: null,
  categories: []
};

const filters = {
  cycle: null,
  month: "2026-09",
  category: "Shopping",
  type: "expense" as const,
  search: "Electronics",
  cursor: "opaque",
  direction: "next" as const
};

test("posts the trusted timeline query with month and existing filters", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const result = await loadTransactionTimeline({
    telegramUserId: "976684739",
    asOfDate: "2026-09-18",
    filters
  }, async (input, init) => {
    calls.push({ input, init });
    return Response.json(page);
  });

  assert.deepEqual(result, { data: page, error: false });
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/timeline/query");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    asOfDate: "2026-09-18",
    timezone: "Asia/Jakarta",
    limit: 50,
    month: "2026-09",
    category: "Shopping",
    type: "expense",
    merchantQuery: "Electronics",
    cursor: "opaque",
    direction: "next"
  });
});

test("rejects a month and cycle combination before fetching", async () => {
  let calls = 0;
  const result = await loadTransactionTimeline({
    telegramUserId: "976684739",
    asOfDate: "2026-09-18",
    filters: { ...filters, cycle: "current" }
  }, async () => {
    calls += 1;
    return Response.json(page);
  });

  assert.deepEqual(result, { data: null, error: true });
  assert.equal(calls, 0);
});

test("maps malformed, non-200, and transport failures to unavailable data", async () => {
  const input = { telegramUserId: "976684739", asOfDate: "2026-09-18", filters: { ...filters } };
  for (const fetchImpl of [
    async () => new Response("secret", { status: 500 }),
    async () => Response.json({ ...page, items: [{ kind: "unknown" }] }),
    async () => { throw new Error("timeout"); }
  ]) {
    assert.deepEqual(await loadTransactionTimeline(input, fetchImpl), { data: null, error: true });
  }
});
