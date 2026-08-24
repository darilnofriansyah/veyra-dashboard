import assert from "node:assert/strict";
import test from "node:test";
import {
  createPocket,
  loadPocketStatus,
  loadPockets,
  renamePocket,
  setDefaultPocket,
  updatePocketBudget
} from "../src/lib/pockets-api.ts";

const validPocket = { id: "42", name: "Daily spending", amount: 500_000, isDefault: true };
const validPockets = { status: "ok", pockets: [validPocket] };
const validBudget = {
  budget_id: 42,
  category: "Daily spending",
  amount: 500_000,
  parent_budget_id: null,
  parent_category: null,
  period_type: "monthly",
  action: "created"
};
const validPocketStatus = {
  budget_id: "42",
  category: "Daily spending",
  parent_budget_id: null,
  budget_amount: 500_000,
  spent_amount: 325_000,
  remaining_amount: 175_000,
  spent_percent: 65,
  child_breakdown: [{
    budget_id: "43",
    category: "Dining",
    budget_amount: 200_000,
    spent_amount: 150_000,
    remaining_amount: 50_000,
    spent_percent: 75
  }],
  cycle_start: "2026-08-15",
  cycle_end: "2026-09-15"
};
const environment = process.env as Record<string, string | undefined>;

async function withEnvironment(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, environment[key]]));
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

test("lists pockets with the user ID and accepts a created response", async () => {
  await withEnvironment({ NEXUS_CORE_URL: undefined, CORE_API_KEY: undefined }, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const result = await loadPockets("976684739", async (input, init) => {
      calls.push({ input, init });
      return Response.json(validPockets, { status: 201 });
    });

    assert.deepEqual(result, { pockets: [validPocket], error: false });
    assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/budgets/pockets/list");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.deepEqual(calls[0]?.init?.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { userId: "976684739" });
  });
});

test("loads one owned pocket status with authenticated identity and pocket ID", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const result = await loadPocketStatus("976684739", "42", "2026-08-24", async (input, init) => {
    calls.push({ input, init });
    return Response.json(validPocketStatus);
  });

  assert.deepEqual(result, validPocketStatus);
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/budgets/status");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    pocketId: "42",
    asOfDate: "2026-08-24"
  });
});

test("rejects invalid or inaccessible pocket status requests safely", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(null, { status: 404 });
  };

  assert.equal(await loadPocketStatus("976684739", "0", "2026-08-24", fetchImpl), null);
  assert.equal(await loadPocketStatus("976684739", "42", "invalid", fetchImpl), null);
  assert.equal(calls, 0);
  assert.equal(await loadPocketStatus("976684739", "42", "2026-08-24", fetchImpl), null);
  assert.equal(calls, 1);
});

test("sends Core credentials and a five-second timeout", async () => {
  await withEnvironment({ NEXUS_CORE_URL: "http://core-api:3000///", CORE_API_KEY: "test-key" }, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const timeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    AbortSignal.timeout = (milliseconds) => {
      timeouts.push(milliseconds);
      return timeout(milliseconds);
    };
    try {
      await loadPockets("976684739", async (input, init) => {
        calls.push({ input, init });
        return Response.json(validPockets);
      });
    } finally {
      AbortSignal.timeout = timeout;
    }
    assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/budgets/pockets/list");
    assert.deepEqual(calls[0]?.init?.headers, { "content-type": "application/json", "x-core-api-key": "test-key" });
    assert.deepEqual(timeouts, [5_000]);
  });
});

test("creates and updates monthly pocket budgets", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({
      ...validBudget,
      budget_id: "42",
      action: calls.length === 1 ? "created" : "updated"
    });
  };
  assert.deepEqual(await createPocket("976684739", { name: " Daily spending ", amount: 500_000 }, fetchImpl), { status: "success" });
  assert.deepEqual(await updatePocketBudget("976684739", "Daily spending", 600_000, fetchImpl), { status: "success" });
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/budgets/upsert");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739", category: "Daily spending", amount: 500_000, periodType: "monthly"
  });
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    telegramUserId: "976684739", category: "Daily spending", amount: 600_000, periodType: "monthly"
  });
});

test("renames and sets the default pocket with exact payloads", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json(validPocket);
  };
  assert.deepEqual(await renamePocket("976684739", "42", " Daily spending ", fetchImpl), { status: "success" });
  assert.deepEqual(await setDefaultPocket("976684739", "42", fetchImpl), { status: "success" });
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/budgets/pockets/rename");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739", pocketId: "42", name: "Daily spending"
  });
  assert.equal(String(calls[1]?.input), "http://core-api:3000/api/veyra/budgets/pockets/default");
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { telegramUserId: "976684739", pocketId: "42" });
});

test("rejects invalid local inputs without fetching", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json(validPocket);
  };
  assert.deepEqual(await loadPockets("invalid", fetchImpl), { pockets: [], error: true });
  assert.deepEqual(await createPocket("invalid", { name: "Pocket", amount: 1 }, fetchImpl), { status: "validation", fieldErrors: {} });
  assert.deepEqual(await createPocket("976684739", { name: " ", amount: 1 }, fetchImpl), { status: "validation", fieldErrors: {} });
  assert.deepEqual(await updatePocketBudget("976684739", "Pocket", 0, fetchImpl), { status: "validation", fieldErrors: {} });
  assert.deepEqual(await renamePocket("976684739", "invalid", "Pocket", fetchImpl), { status: "validation", fieldErrors: {} });
  assert.deepEqual(await setDefaultPocket("976684739", "0", fetchImpl), { status: "validation", fieldErrors: {} });
  assert.equal(calls, 0);
});

test("maps action status, malformed responses, and transport failures safely", async () => {
  for (const [status, expected] of [
    [400, { status: "validation", fieldErrors: {} }],
    [404, { status: "not_found" }],
    [500, { status: "unavailable" }]
  ] as const) {
    assert.deepEqual(await renamePocket("976684739", "42", "Pocket", async () =>
      new Response("secret upstream response", { status })
    ), expected);
  }
  assert.deepEqual(await createPocket("976684739", { name: "Pocket", amount: 1 }, async () =>
    Response.json({ ...validBudget, amount: 0 })
  ), { status: "unavailable" });
  assert.deepEqual(await setDefaultPocket("976684739", "42", async () => Response.json({ ...validPocket, id: "invalid" })), {
    status: "unavailable"
  });
  assert.deepEqual(await updatePocketBudget("976684739", "Pocket", 1, async () => { throw new Error("connection failed"); }), {
    status: "unavailable"
  });
  assert.deepEqual(await loadPockets("976684739", async () => Response.json({ status: "ok", pockets: [{ ...validPocket, amount: -1 }] })), {
    pockets: [], error: true
  });
});
