import assert from "node:assert/strict";
import test from "node:test";
import {
  loadTransactions,
  updateTransaction
} from "../src/lib/transactions-api.ts";

const validTransaction = {
  id: "123",
  amount: 30_000,
  merchant: "Tuku Kemang",
  category: "Dining",
  type: "expense",
  source: "telegram",
  transactionDate: "2026-08-13T03:00:00.000Z",
  updatedAt: "2026-08-13T03:01:00.000Z",
  creditCard: false
};

const validTransactionPage = {
  items: [validTransaction],
  previousCursor: null,
  nextCursor: "next-1",
  categories: ["Dining"]
};

const validInput = {
  expectedUpdatedAt: "2026-08-13T03:01:00.000Z",
  amount: 30_000,
  merchant: "Tuku Kemang",
  category: "Dining"
};

const environment = process.env as Record<string, string | undefined>;

async function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => Promise<void>
): Promise<void> {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, environment[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete environment[key];
    else environment[key] = value;
  }

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
  }
}

test("posts one uncached user-scoped transaction query", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const loaded = await loadTransactions({
    telegramUserId: "976684739",
    asOfDate: "2026-08-13",
    filters: {
      cycle: "current", category: "Dining", type: "expense",
      search: "tuku", cursor: "cursor-1", direction: "next"
    }
  }, async (input, init) => {
    calls.push({ input, init });
    return Response.json(validTransactionPage);
  });

  assert.equal(loaded.error, false);
  assert.deepEqual(loaded.data, validTransactionPage);
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/query");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    asOfDate: "2026-08-13",
    timezone: "Asia/Jakarta",
    limit: 50,
    cycle: "current",
    category: "Dining",
    type: "expense",
    merchantQuery: "tuku",
    cursor: "cursor-1",
    direction: "next"
  });
});

test("includes Core credentials, removes trailing slashes, and uses a five-second timeout", async () => {
  await withEnvironment({
    NEXUS_CORE_URL: "http://core-api:3000///",
    CORE_API_KEY: "test-key"
  }, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const timeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    AbortSignal.timeout = (milliseconds) => {
      timeouts.push(milliseconds);
      return timeout(milliseconds);
    };

    try {
      await loadTransactions({
        telegramUserId: "976684739",
        asOfDate: "2026-08-13",
        filters: { cycle: null, category: null, type: null, search: null, cursor: null, direction: null }
      }, async (input, init) => {
        calls.push({ input, init });
        return Response.json(validTransactionPage);
      });
    } finally {
      AbortSignal.timeout = timeout;
    }

    assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/query");
    assert.deepEqual(calls[0]?.init?.headers, {
      "content-type": "application/json",
      "x-core-api-key": "test-key"
    });
    assert.deepEqual(timeouts, [5_000]);
  });
});

test("omits inactive transaction query filters", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  await loadTransactions({
    telegramUserId: "976684739",
    asOfDate: "2026-08-13",
    filters: { cycle: null, category: null, type: null, search: null, cursor: null, direction: null }
  }, async (input, init) => {
    calls.push({ input, init });
    return Response.json(validTransactionPage);
  });

  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    asOfDate: "2026-08-13",
    timezone: "Asia/Jakarta",
    limit: 50
  });
});

test("rejects invalid query identity and date without calling Core", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json(validTransactionPage);
  };

  for (const [telegramUserId, asOfDate] of [
    ["invalid", "2026-08-13"],
    ["976684739", "2026-02-30"],
    ["976684739", "2026-08-13T00:00:00Z"]
  ]) {
    assert.deepEqual(await loadTransactions({
      telegramUserId,
      asOfDate,
      filters: { cycle: null, category: null, type: null, search: null, cursor: null, direction: null }
    }, fetchImpl), { data: null, error: true });
  }
  assert.equal(calls, 0);
});

test("maps unsafe query responses to one safe error result", async () => {
  const responses: Array<() => Promise<Response>> = [
    async () => new Response("secret upstream response", { status: 500 }),
    async () => { throw new Error("connection failed"); },
    async () => new Response("{", { headers: { "content-type": "application/json" } }),
    async () => Response.json({ ...validTransactionPage, categories: ["Dining", "Dining"] })
  ];

  for (const respond of responses) {
    assert.deepEqual(await loadTransactions({
      telegramUserId: "976684739",
      asOfDate: "2026-08-13",
      filters: { cycle: null, category: null, type: null, search: null, cursor: null, direction: null }
    }, respond), { data: null, error: true });
  }
});

test("patches a transaction with the optimistic version and parses strict success", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const updated = await updateTransaction("976684739", "123", validInput, async (input, init) => {
    calls.push({ input, init });
    return Response.json(validTransaction);
  });

  assert.deepEqual(updated, { status: "success", transaction: validTransaction });
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/123");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    amount: 30_000,
    merchant: "Tuku Kemang",
    category: "Dining",
    expectedUpdatedAt: "2026-08-13T03:01:00.000Z"
  });
});

test("patches with Core credentials and a five-second timeout", async () => {
  await withEnvironment({ CORE_API_KEY: "test-key" }, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const timeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    AbortSignal.timeout = (milliseconds) => {
      timeouts.push(milliseconds);
      return timeout(milliseconds);
    };

    try {
      await updateTransaction("976684739", "123", validInput, async (input, init) => {
        calls.push({ input, init });
        return Response.json(validTransaction);
      });
    } finally {
      AbortSignal.timeout = timeout;
    }

    assert.deepEqual(calls[0]?.init?.headers, {
      "content-type": "application/json",
      "x-core-api-key": "test-key"
    });
    assert.deepEqual(timeouts, [5_000]);
  });
});

test("rejects update identity and transaction ID without calling Core", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json(validTransaction);
  };

  assert.deepEqual(await updateTransaction("invalid", "123", validInput, fetchImpl), { status: "unavailable" });
  assert.deepEqual(await updateTransaction("976684739", "not-a-number", validInput, fetchImpl), { status: "unavailable" });
  assert.equal(calls, 0);
});

test("maps exact PATCH error statuses without forwarding Core responses", async () => {
  for (const [status, expected] of [
    [400, { status: "validation", fieldErrors: {} }],
    [404, { status: "not_found" }],
    [409, { status: "conflict" }],
    [500, { status: "unavailable" }]
  ] as const) {
    assert.deepEqual(
      await updateTransaction("976684739", "123", validInput, async () =>
        new Response("secret upstream response", { status })
      ),
      expected
    );
  }

  assert.deepEqual(
    await updateTransaction("976684739", "123", validInput, async () => {
      throw new Error("connection failed");
    }),
    { status: "unavailable" }
  );
});

test("maps malformed PATCH success data to unavailable", async () => {
  assert.deepEqual(
    await updateTransaction("976684739", "123", validInput, async () =>
      Response.json({ ...validTransaction, type: "transfer" })
    ),
    { status: "unavailable" }
  );
});
