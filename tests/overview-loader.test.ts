import test from "node:test";
import assert from "node:assert/strict";
import { loadOverview } from "../src/lib/overview-loader.ts";

const period = (label: "current_cycle" | "previous_cycle", start: string, end: string) => ({
  period: { label, start, end },
  hasTransactions: true,
  totals: {
    income: 10_000_000,
    spent: 4_000_000,
    netCashflow: 6_000_000,
    dailyAverage: 160_000
  },
  comparison: {
    income: 9_000_000,
    spent: 3_500_000,
    netCashflow: 5_500_000,
    dailyAverage: 140_000
  },
  dailySpend: [{ date: start, amount: 25_000 }],
  categories: [{
    category: "Food",
    amount: 1_000_000,
    percent: 25,
    transactionCount: 4
  }],
  budgets: [{
    category: "Food",
    limit: 1_500_000,
    spent: 1_000_000,
    percent: 67,
    status: "on-track" as const
  }],
  recentTransactions: [{
    id: "transaction-1",
    date: start,
    merchant: "TUKU",
    category: "Food",
    amount: 25_000,
    type: "expense" as const
  }],
  alert: null
});

const validResponse = {
  user: { id: "1", telegramUserId: "976684739" },
  current: period("current_cycle", "2026-07-15", "2026-08-15"),
  previous: period("previous_cycle", "2026-06-15", "2026-07-15")
};

const environment = process.env as Record<string, string | undefined>;

function withEnvironment(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, environment[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete environment[key];
    else environment[key] = value;
  }

  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
  });
}

test("posts one uncached authenticated request with configured identity", async () => {
  await withEnvironment({
    NEXUS_CORE_URL: "http://core-api:3000/",
    CORE_API_KEY: "test-key",
    VEYRA_TELEGRAM_USER_ID: "976684739",
    VEYRA_USER_ID: "1"
  }, async () => {
    let request: { input: string | URL | Request; init?: RequestInit } | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = { input, init };
      return Response.json(validResponse);
    };

    const loaded = await loadOverview("2026-07-25", fetchImpl);

    assert.equal(loaded.error, false);
    assert.deepEqual(loaded.data, validResponse);
    assert.equal(String(request?.input), "http://core-api:3000/api/veyra/dashboard/overview");
    assert.equal(request?.init?.method, "POST");
    assert.equal(request?.init?.cache, "no-store");
    assert.deepEqual(request?.init?.headers, {
      "content-type": "application/json",
      "x-core-api-key": "test-key"
    });
    assert.deepEqual(JSON.parse(String(request?.init?.body)), {
      telegramUserId: "976684739",
      userId: 1,
      asOfDate: "2026-07-25",
      timezone: "Asia/Jakarta"
    });
    assert.ok(request?.init?.signal);
  });
});

test("uses the requested default user identifiers", async () => {
  await withEnvironment({
    NEXUS_CORE_URL: "http://core-api:3000",
    CORE_API_KEY: undefined,
    VEYRA_TELEGRAM_USER_ID: undefined,
    VEYRA_USER_ID: undefined
  }, async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json(validResponse);
    };

    await loadOverview("2026-07-25", fetchImpl);

    assert.equal(body.telegramUserId, "976684739");
    assert.equal(body.userId, 1);
  });
});

test("maps network and non-success responses to one safe error result", async () => {
  const network = await loadOverview("2026-07-25", async () => {
    throw new Error("connection failed");
  });
  const unauthorized = await loadOverview(
    "2026-07-25",
    async () => new Response("secret upstream response", { status: 401 })
  );

  assert.deepEqual(network, { data: null, error: true });
  assert.deepEqual(unauthorized, { data: null, error: true });
});

test("rejects malformed nested financial values", async () => {
  const malformed = structuredClone(validResponse);
  malformed.current.totals.spent = -1;

  const loaded = await loadOverview(
    "2026-07-25",
    async () => Response.json(malformed)
  );

  assert.deepEqual(loaded, { data: null, error: true });
});
