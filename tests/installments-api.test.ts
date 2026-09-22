import assert from "node:assert/strict";
import test from "node:test";
import {
  createInstallments,
  previewInstallments
} from "../src/lib/installments-api.ts";

const request = {
  expectedUpdatedAt: "2026-09-18T03:01:00.123456Z",
  tenorMonths: 6,
  monthlyRatePercent: "0",
  firstDueDate: "2026-10-18"
};

const preview = {
  originalTransactionId: "123",
  originalUpdatedAt: request.expectedUpdatedAt,
  principal: 6_000_000,
  totalInterest: 0,
  totalPayable: 6_000_000,
  timezone: "Asia/Jakarta",
  terms: {
    tenorMonths: 6,
    monthlyRatePercent: "0",
    firstDueDate: request.firstDueDate
  },
  items: ["2026-10-18", "2026-11-18", "2026-12-18", "2027-01-18", "2027-02-18", "2027-03-18"].map((dueDate, index) => ({
    sequence: index + 1,
    dueDate,
    principal: 1_000_000,
    interest: 0,
    total: 1_000_000
  }))
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

test("previews with the exact server request and accepts zero rate", async () => {
  await withEnvironment({ NEXUS_CORE_URL: undefined, CORE_API_KEY: undefined }, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const result = await previewInstallments("976684739", "123", request, async (input, init) => {
      calls.push({ input, init });
      return Response.json(preview);
    });

    assert.deepEqual(result, { status: "success", preview });
    assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/123/installments/preview");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      telegramUserId: "976684739",
      ...request
    });
  });
});

test("forwards only trusted identity and known Core fields", async () => {
  const calls: Array<{ init?: RequestInit }> = [];
  const requestWithUnknownFields = {
    ...request,
    telegramUserId: "attacker",
    unexpected: "secret"
  } as typeof request & { telegramUserId: string; unexpected: string };
  await previewInstallments("976684739", "123", requestWithUnknownFields, async (_input, init) => {
    calls.push({ init });
    return Response.json(preview);
  });

  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    telegramUserId: "976684739",
    ...request
  });
});

test("creates a plan and maps Core status responses", async () => {
  const plan = { ...preview, planId: "7" };
  assert.deepEqual(await createInstallments("976684739", "123", request, async () => Response.json(plan)), {
    status: "success",
    plan
  });

  for (const [status, expected] of [
    [400, { status: "validation", fieldErrors: {} }],
    [404, { status: "not_found" }],
    [409, { status: "conflict" }],
    [500, { status: "unavailable" }]
  ] as const) {
    assert.deepEqual(await previewInstallments("976684739", "123", request, async () => new Response("secret", { status })), expected);
  }
});

test("turns malformed responses, timeouts, and invalid local input into safe unavailable states", async () => {
  assert.deepEqual(await previewInstallments("976684739", "123", request, async () => Response.json({ ...preview, totalPayable: -1 })), {
    status: "unavailable"
  });
  assert.deepEqual(await previewInstallments("976684739", "123", request, async () => { throw new Error("timeout"); }), {
    status: "unavailable"
  });

  let calls = 0;
  assert.deepEqual(await createInstallments("browser-user", "123", request, async () => {
    calls += 1;
    return Response.json({ ...preview, planId: "7" });
  }), { status: "unavailable" });
  assert.equal(calls, 0);
});
