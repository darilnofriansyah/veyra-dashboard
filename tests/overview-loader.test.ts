import test from "node:test";
import assert from "node:assert/strict";
import { loadOverview } from "../src/lib/overview-loader.ts";

const period = (
  label: "current_cycle" | "previous_cycle",
  start: string,
  end: string,
  creditCard = {
    limit: 10_000_000,
    used: 4_700_000,
    statementBalance: 3_250_000
  }
) => ({
  period: { label, start, end },
  hasTransactions: true,
  creditCard,
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
  previous: period(
    "previous_cycle",
    "2026-06-15",
    "2026-07-15",
    { limit: 0, used: 0, statementBalance: 0 }
  )
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
    CORE_API_KEY: "test-key"
  }, async () => {
    const requests: Array<{
      input: Parameters<typeof fetch>[0];
      init?: Parameters<typeof fetch>[1];
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input, init });
      return Response.json(validResponse);
    };

    const loaded = await loadOverview(
      "2026-07-25",
      "976684739",
      fetchImpl
    );
    const [request] = requests;

    assert.equal(loaded.error, false);
    assert.deepEqual(loaded.data, validResponse);
    assert.ok(request);
    assert.equal(String(request.input), "http://core-api:3000/api/veyra/dashboard/overview");
    assert.equal(request.init?.method, "POST");
    assert.equal(request.init?.cache, "no-store");
    assert.deepEqual(request.init?.headers, {
      "content-type": "application/json",
      "x-core-api-key": "test-key"
    });
    assert.deepEqual(JSON.parse(String(request.init?.body)), {
      telegramUserId: "976684739",
      asOfDate: "2026-07-25",
      timezone: "Asia/Jakarta"
    });
    assert.ok(request.init?.signal);
  });
});

test("rejects an invalid session identity without calling Core", async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async () => {
    requests += 1;
    return Response.json(validResponse);
  };

  assert.deepEqual(
    await loadOverview("2026-07-25", "invalid", fetchImpl),
    { data: null, error: true }
  );
  assert.equal(requests, 0);
});

test("maps network and non-success responses to one safe error result", async () => {
  const network = await loadOverview(
    "2026-07-25",
    "976684739",
    async () => {
      throw new Error("connection failed");
    }
  );
  const unauthorized = await loadOverview(
    "2026-07-25",
    "976684739",
    async () => new Response("secret upstream response", { status: 401 })
  );

  assert.deepEqual(network, { data: null, error: true });
  assert.deepEqual(unauthorized, { data: null, error: true });
});

test("accepts overview responses while the Core API alert field is pending", async () => {
  const body = structuredClone(validResponse) as Record<string, unknown>;
  delete (body.current as Record<string, unknown>).alert;
  delete (body.previous as Record<string, unknown>).alert;

  const loaded = await loadOverview(
    "2026-07-25",
    "976684739",
    async () => Response.json(body, { status: 201 })
  );

  assert.equal(loaded.error, false);
  assert.equal(loaded.data?.current.alert, null);
  assert.equal(loaded.data?.previous.alert, null);
});

test("rejects malformed overview responses", async (t) => {
  const malformedCases: Array<[string, () => Response]> = [
    ["date", () => {
      const body = structuredClone(validResponse);
      body.current.period.start = "2026-02-30";
      return Response.json(body);
    }],
    ["enum", () => {
      const body = structuredClone(validResponse) as {
        current: { recentTransactions: Array<{ type: string }> };
      };
      body.current.recentTransactions[0].type = "transfer";
      return Response.json(body);
    }],
    ["missing required array", () => {
      const body = structuredClone(validResponse) as Record<string, unknown>;
      delete (body.current as Record<string, unknown>).categories;
      return Response.json(body);
    }],
    ["invalid required array", () => {
      const body = structuredClone(validResponse) as {
        current: { budgets: unknown };
      };
      body.current.budgets = {};
      return Response.json(body);
    }],
    ["missing credit card", () => {
      const body = structuredClone(validResponse) as Record<string, unknown>;
      delete (body.current as Record<string, unknown>).creditCard;
      return Response.json(body);
    }],
    ["negative statement balance", () => {
      const body = structuredClone(validResponse);
      body.current.creditCard.statementBalance = -1;
      return Response.json(body);
    }],
    ["malformed JSON", () => new Response("{", {
      headers: { "content-type": "application/json" }
    })],
    ["alert", () => {
      const body = structuredClone(validResponse) as {
        current: { alert: unknown };
      };
      body.current.alert = {
        category: "Food",
        limit: 0,
        spent: 1_000_000,
        percent: 100,
        status: "over"
      };
      return Response.json(body);
    }]
  ];

  for (const [name, response] of malformedCases) {
    await t.test(name, async () => {
      const loaded = await loadOverview(
        "2026-07-25",
        "976684739",
        async () => response()
      );
      assert.deepEqual(loaded, { data: null, error: true });
    });
  }
});
