# Veyra Nexus Core Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Veyra dashboard fixtures with one authenticated, server-side Nexus Core overview request while preserving the existing accessible read-only dashboard.

**Architecture:** The App Router page calls a server-only loader on every request. The loader sends one `cache: "no-store"` POST to Nexus Core, validates the response at the trust boundary, and passes the two cycle summaries to the existing client dashboard. The client keeps only period-selection state and renders API-provided totals, charts, budgets, transactions, alerts, and deterministic insight copy.

**Tech Stack:** Next.js 16.2.11 App Router, React 19, TypeScript 5.9, Node.js 24 built-in tests, native `fetch`, `AbortSignal.timeout`, Docker Compose.

## Global Constraints

- Consume `POST /api/veyra/dashboard/overview`; do not call the conversational endpoints.
- Keep `CORE_API_KEY` server-only and send it as `x-core-api-key`.
- Use `cache: "no-store"` and a five-second abort timeout.
- Default `VEYRA_TELEGRAM_USER_ID` to `976684739` and `VEYRA_USER_ID` to `1`.
- Default timezone to `Asia/Jakarta`.
- Treat the API response as untrusted input and reject malformed nested values.
- Render one aggregate error state for network, timeout, non-2xx, and malformed-response failures.
- Keep route loading, retry, empty states, keyboard behavior, and screen-reader labels.
- Change period labels from `This Month` / `Last Month` to `Current Cycle` / `Previous Cycle`.
- Add no dependency, browser API request, Route Handler proxy, state library, or data-fetching library.
- Delete runtime fixtures and client-side financial aggregation.
- Do not require a running Core API for unit tests or `next build`.
- Do not modify `../core-api` from this repository.

---

## File map

| Path | Responsibility |
|---|---|
| `.env.example` | Documents server-only Core API URL, key, and default identity |
| `docker-compose.yaml` | Supplies runtime Core API configuration to the Veyra container |
| `src/lib/finance.ts` | Shared dashboard display contracts and IDR formatting |
| `src/lib/overview-loader.ts` | Authenticated Nexus Core request, timeout, validation, and error mapping |
| `src/app/dashboard/page.tsx` | Request-time date and server loader entry point |
| `src/components/overview-dashboard.tsx` | Period selection and rendering of API summaries |
| `tests/overview-loader.test.ts` | Loader request and trust-boundary behavior |
| `tests/finance.test.ts` | IDR display formatting still owned by the dashboard |
| `tests/static.test.mjs` | Integration structure, server-only secrets, cycle UI, and accessibility checks |
| `src/lib/fixtures.ts` | Deleted; no runtime fixture source remains |

---

### Task 1: Add the server-only Nexus Core loader

**Files:**
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/overview-loader.ts`
- Modify: `tests/finance.test.ts`
- Modify: `tests/overview-loader.test.ts`

**Interfaces:**
- Produces: `Period = "current" | "previous"`
- Produces: `BudgetStatus = "on-track" | "warning" | "over"`
- Produces: `PeriodOverview`
- Produces: `OverviewResponse`
- Produces: `OverviewLoaderResult`
- Produces: `loadOverview(asOfDate: string, fetchImpl?: typeof fetch): Promise<OverviewLoaderResult>`
- Consumes: `POST ${NEXUS_CORE_URL}/api/veyra/dashboard/overview`

- [ ] **Step 1: Replace the finance-calculation tests with the remaining display contract**

Replace `tests/finance.test.ts` with:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatIdr } from "../src/lib/finance.ts";

test("formats whole rupiah using Indonesian grouping", () => {
  assert.match(formatIdr(8_247_300), /^IDR\s8\.247\.300$/);
});

test("keeps negative cashflow signs", () => {
  assert.match(formatIdr(-250_000), /^-IDR\s250\.000$/);
});
```

- [ ] **Step 2: Write the failing loader tests**

Replace `tests/overview-loader.test.ts` with a focused mock-fetch test file. Define this complete response helper at the top of the file:

```ts
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
```

Add a request test that captures the URL and `RequestInit`:

```ts
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
```

Add a defaults test:

```ts
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
```

Add independent failure cases:

```ts
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
```

- [ ] **Step 3: Run the tests and confirm the old loader contract fails**

Run:

```bash
npm test -- tests/finance.test.ts tests/overview-loader.test.ts
```

Expected: FAIL because `loadOverview` still returns fixture transaction/budget results and does not issue a request.

- [ ] **Step 4: Replace finance aggregation with shared display contracts**

Replace `src/lib/finance.ts` with:

```ts
export type Period = "current" | "previous";
export type BudgetStatus = "on-track" | "warning" | "over";

export interface Totals {
  income: number;
  spent: number;
  netCashflow: number;
  dailyAverage: number;
}

export interface BudgetSummary {
  category: string;
  limit: number;
  spent: number;
  percent: number;
  status: BudgetStatus;
}

export interface PeriodOverview {
  period: {
    label: "current_cycle" | "previous_cycle";
    start: string;
    end: string;
  };
  hasTransactions: boolean;
  totals: Totals;
  comparison: Totals;
  dailySpend: Array<{ date: string; amount: number }>;
  categories: Array<{
    category: string;
    amount: number;
    percent: number;
    transactionCount: number;
  }>;
  budgets: BudgetSummary[];
  recentTransactions: Array<{
    id: string;
    date: string;
    merchant: string | null;
    category: string | null;
    amount: number;
    type: "income" | "expense";
  }>;
  alert: BudgetSummary | null;
}

export interface OverviewResponse {
  user: {
    id: string;
    telegramUserId: string;
  };
  current: PeriodOverview;
  previous: PeriodOverview;
}

const formatter = new Intl.NumberFormat("en-ID", {
  style: "currency",
  currency: "IDR",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

export function formatIdr(value: number) {
  return formatter.format(value).replace(/\u00a0/g, " ");
}
```

- [ ] **Step 5: Implement the trust-boundary parser and request**

Replace `src/lib/overview-loader.ts`.

Use these public and internal signatures:

```ts
import type {
  BudgetStatus,
  BudgetSummary,
  OverviewResponse,
  PeriodOverview,
  Totals
} from "./finance.ts";

export type OverviewLoaderResult = {
  data: OverviewResponse | null;
  error: boolean;
};

type JsonObject = Record<string, unknown>;
type FetchImplementation = typeof fetch;
```

Add small validation helpers:

```ts
const DEFAULT_CORE_URL = "http://core-api:3000";
const DEFAULT_TELEGRAM_USER_ID = "976684739";
const DEFAULT_USER_ID = 1;
const TIMEZONE = "Asia/Jakarta";
const BUDGET_STATUSES = new Set<BudgetStatus>(["on-track", "warning", "over"]);
const PERIOD_LABELS = new Set(["current_cycle", "previous_cycle"]);

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as JsonObject;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function rupiah(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return number;
}

function signedRupiah(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${name}`);
  return number;
}

function positiveRupiah(value: unknown, name: string): number {
  const number = rupiah(value, name);
  if (number === 0) throw new Error(`Invalid ${name}`);
  return number;
}

function nonNegativeNumber(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (number < 0) throw new Error(`Invalid ${name}`);
  return number;
}

function count(value: unknown, name: string): number {
  const number = rupiah(value, name);
  return number;
}

function nullableText(value: unknown, name: string): string | null {
  return value === null ? null : text(value, name);
}

function isoDate(value: unknown, name: string): string {
  const date = text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ${name}`);
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ${name}`);
  }
  return date;
}

function list<T>(
  value: unknown,
  name: string,
  parse: (item: unknown, index: number) => T
): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value.map(parse);
}
```

Implement parsers with these exact output mappings:

```ts
function parseTotals(value: unknown, name: string): Totals {
  const item = object(value, name);
  return {
    income: rupiah(item.income, `${name}.income`),
    spent: rupiah(item.spent, `${name}.spent`),
    netCashflow: signedRupiah(item.netCashflow, `${name}.netCashflow`),
    dailyAverage: rupiah(item.dailyAverage, `${name}.dailyAverage`)
  };
}

function parseBudget(value: unknown, name: string): BudgetSummary {
  const item = object(value, name);
  const status = text(item.status, `${name}.status`) as BudgetStatus;
  if (!BUDGET_STATUSES.has(status)) throw new Error(`Invalid ${name}.status`);
  return {
    category: text(item.category, `${name}.category`),
    limit: positiveRupiah(item.limit, `${name}.limit`),
    spent: rupiah(item.spent, `${name}.spent`),
    percent: nonNegativeNumber(item.percent, `${name}.percent`),
    status
  };
}
```

Implement the nested period parser:

```ts
function parsePeriodOverview(value: unknown, name: string): PeriodOverview {
  const item = object(value, name);
  const periodValue = object(item.period, `${name}.period`);
  const label = text(
    periodValue.label,
    `${name}.period.label`
  ) as PeriodOverview["period"]["label"];
  if (!PERIOD_LABELS.has(label)) {
    throw new Error(`Invalid ${name}.period.label`);
  }
  const start = isoDate(periodValue.start, `${name}.period.start`);
  const end = isoDate(periodValue.end, `${name}.period.end`);
  if (start >= end) throw new Error(`Invalid ${name}.period`);
  if (typeof item.hasTransactions !== "boolean") {
    throw new Error(`Invalid ${name}.hasTransactions`);
  }

  return {
    period: { label, start, end },
    hasTransactions: item.hasTransactions,
    totals: parseTotals(item.totals, `${name}.totals`),
    comparison: parseTotals(item.comparison, `${name}.comparison`),
    dailySpend: list(item.dailySpend, `${name}.dailySpend`, (value, index) => {
      const day = object(value, `${name}.dailySpend[${index}]`);
      return {
        date: isoDate(day.date, `${name}.dailySpend[${index}].date`),
        amount: rupiah(day.amount, `${name}.dailySpend[${index}].amount`)
      };
    }),
    categories: list(item.categories, `${name}.categories`, (value, index) => {
      const category = object(value, `${name}.categories[${index}]`);
      return {
        category: text(category.category, `${name}.categories[${index}].category`),
        amount: rupiah(category.amount, `${name}.categories[${index}].amount`),
        percent: nonNegativeNumber(
          category.percent,
          `${name}.categories[${index}].percent`
        ),
        transactionCount: count(
          category.transactionCount,
          `${name}.categories[${index}].transactionCount`
        )
      };
    }),
    budgets: list(item.budgets, `${name}.budgets`, (value, index) =>
      parseBudget(value, `${name}.budgets[${index}]`)
    ),
    recentTransactions: list(
      item.recentTransactions,
      `${name}.recentTransactions`,
      (value, index) => {
        const transaction = object(
          value,
          `${name}.recentTransactions[${index}]`
        );
        const type = text(
          transaction.type,
          `${name}.recentTransactions[${index}].type`
        );
        if (type !== "income" && type !== "expense") {
          throw new Error(`Invalid ${name}.recentTransactions[${index}].type`);
        }
        return {
          id: text(transaction.id, `${name}.recentTransactions[${index}].id`),
          date: isoDate(
            transaction.date,
            `${name}.recentTransactions[${index}].date`
          ),
          merchant: nullableText(
            transaction.merchant,
            `${name}.recentTransactions[${index}].merchant`
          ),
          category: nullableText(
            transaction.category,
            `${name}.recentTransactions[${index}].category`
          ),
          amount: rupiah(
            transaction.amount,
            `${name}.recentTransactions[${index}].amount`
          ),
          type
        };
      }
    ),
    alert: item.alert === null
      ? null
      : parseBudget(item.alert, `${name}.alert`)
  };
}
```

`parseOverviewResponse(value)` must:

```ts
function parseOverviewResponse(value: unknown): OverviewResponse {
  const response = object(value, "overview response");
  const user = object(response.user, "user");
  const current = parsePeriodOverview(response.current, "current");
  const previous = parsePeriodOverview(response.previous, "previous");
  if (
    current.period.label !== "current_cycle"
    || previous.period.label !== "previous_cycle"
  ) {
    throw new Error("Invalid overview period labels");
  }
  return {
    user: {
      id: text(user.id, "user.id"),
      telegramUserId: text(user.telegramUserId, "user.telegramUserId")
    },
    current,
    previous
  };
}
```

Implement the loader:

```ts
const errorResult = (): OverviewLoaderResult => ({ data: null, error: true });

export async function loadOverview(
  asOfDate: string,
  fetchImpl: FetchImplementation = fetch
): Promise<OverviewLoaderResult> {
  try {
    isoDate(asOfDate, "asOfDate");
    const baseUrl = (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
    const apiKey = process.env.CORE_API_KEY;
    const userId = Number(process.env.VEYRA_USER_ID ?? DEFAULT_USER_ID);
    if (!Number.isSafeInteger(userId) || userId <= 0) return errorResult();
    const response = await fetchImpl(`${baseUrl}/api/veyra/dashboard/overview`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-core-api-key": apiKey } : {})
      },
      body: JSON.stringify({
        telegramUserId: process.env.VEYRA_TELEGRAM_USER_ID ?? DEFAULT_TELEGRAM_USER_ID,
        userId,
        asOfDate,
        timezone: TIMEZONE
      })
    });

    if (!response.ok) return errorResult();
    return { data: parseOverviewResponse(await response.json()), error: false };
  } catch {
    return errorResult();
  }
}
```

Do not log the caught error or read a non-success response body.

- [ ] **Step 6: Run the focused loader and display tests**

Run:

```bash
npm test -- tests/finance.test.ts tests/overview-loader.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 7: Commit the server data boundary**

```bash
git add src/lib/finance.ts src/lib/overview-loader.ts tests/finance.test.ts tests/overview-loader.test.ts
git commit -m "feat: load dashboard data from Nexus Core"
```

---

### Task 2: Render API-provided financial cycles

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/overview-dashboard.tsx`
- Modify: `tests/static.test.mjs`
- Delete: `src/lib/fixtures.ts`

**Interfaces:**
- Consumes: `loadOverview(asOfDate)`
- Consumes: `OverviewLoaderResult`
- Consumes: `OverviewResponse.current` and `OverviewResponse.previous`
- Preserves: `comparison(current, previous, lowerIsBetter)`
- Preserves: `SpendingTrend` and `CategoryBreakdown`

- [ ] **Step 1: Update static tests for the real-data boundary**

In `tests/static.test.mjs`, replace the fixture-specific assertions with:

```js
test("loads one server-side Nexus Core overview and passes it to the client", async () => {
  const [page, dashboard, loader] = await Promise.all([
    readSource("src/app/dashboard/page.tsx"),
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/overview-loader.ts")
  ]);

  assert.match(page, /await connection\(\)/);
  assert.match(page, /function jakartaToday\(\)/);
  assert.match(page, /await loadOverview\(asOfDate\)/);
  assert.match(page, /<OverviewDashboard data=\{data\}/);
  assert.match(loader, /\/api\/veyra\/dashboard\/overview/);
  assert.match(loader, /cache:\s*"no-store"/);
  assert.match(loader, /AbortSignal\.timeout\(5_000\)/);
  assert.doesNotMatch(`${page}\n${dashboard}`, /useSearchParams|DemoState|requestedState/);
  assert.doesNotMatch(loader, /createFixtureTransactions|createFixtureBudgets/);
});

test("keeps Core API credentials and identity server-only", async () => {
  const [loader, dashboard] = await Promise.all([
    readSource("src/lib/overview-loader.ts"),
    readSource("src/components/overview-dashboard.tsx")
  ]);

  assert.match(loader, /process\.env\.CORE_API_KEY/);
  assert.match(loader, /"x-core-api-key"/);
  assert.doesNotMatch(`${loader}\n${dashboard}`, /NEXT_PUBLIC_/);
  assert.doesNotMatch(dashboard, /CORE_API_KEY|NEXUS_CORE_URL|fetch\(/);
});
```

Update the existing hierarchy test to require:

```js
assert.match(dashboard, /Current Cycle/);
assert.match(dashboard, /Previous Cycle/);
assert.doesNotMatch(dashboard, /This Month|Last Month/);
assert.equal([...dashboard.matchAll(/useState(?:<[^>]+>)?\(/g)].length, 1);
```

Replace the partial-failure assertion with:

```js
test("renders one aggregate retry state for a failed overview", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /data\.error \|\| !summary/);
  assert.match(dashboard, /Your financial summary couldn’t be loaded\./);
  assert.match(dashboard, /router\.refresh\(\)/);
  assert.doesNotMatch(dashboard, /transactionError|budgetError|guidanceError/);
});
```

- [ ] **Step 2: Run static tests and verify the fixture UI contract fails**

Run:

```bash
npm test -- tests/static.test.mjs
```

Expected: FAIL because the page still parses fixture demo state and the client still summarizes raw fixtures.

- [ ] **Step 3: Simplify the App Router page**

Replace the page function in `src/app/dashboard/page.tsx` with:

```tsx
export default async function Page() {
  await connection();
  const asOfDate = jakartaToday();
  const data = await loadOverview(asOfDate);

  return <OverviewDashboard data={data} />;
}
```

Remove `searchParams`, `DemoState`, and every development fixture-state branch. Keep metadata, `jakartaToday()`, `connection()`, and request-time rendering.

- [ ] **Step 4: Switch the client component to supplied cycle summaries**

Update imports in `src/components/overview-dashboard.tsx`:

```ts
import { comparison } from "@/lib/dashboard-display";
import {
  formatIdr,
  type BudgetStatus,
  type Period
} from "@/lib/finance";
import type { OverviewLoaderResult } from "@/lib/overview-loader";
```

Remove `useMemo`; keep `useState`.

Replace the calendar-month `formatCycle` with:

```ts
const cycleDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

const formatCycle = (start: string, exclusiveEnd: string) => {
  const end = new Date(`${exclusiveEnd}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${cycleDate.format(new Date(`${start}T00:00:00Z`))}–${cycleDate.format(end)}`;
};
```

Change the public component signature and initial values:

```tsx
export function OverviewDashboard({ data }: { data: OverviewLoaderResult }) {
  const [period, setPeriod] = useState<Period>("current");
  const summary = data.data?.[period] ?? null;
  const cycleLabel = summary
    ? formatCycle(summary.period.start, summary.period.end)
    : "Cycle unavailable";
```

Render the existing application shell in both success and error states. Replace the current `transactionError && budgetError` opening condition and error section with:

```tsx
{data.error || !summary ? (
  <section className={panel} aria-label="Financial summary error">
    <Unavailable>Your financial summary couldn’t be loaded.</Unavailable>
  </section>
) : (
```

Keep the current financial-health, explanation, verification, and guidance fragment as the success branch and retain its existing closing `)}`. Apply the exact data substitutions below inside that fragment.

Replace metric construction with:

```ts
const metrics = summary ? [
  {
    label: "Total Spent",
    value: summary.totals.spent,
    previous: summary.comparison.spent,
    lowerIsBetter: true,
    icon: Receipt
  },
  {
    label: "Total Income",
    value: summary.totals.income,
    previous: summary.comparison.income,
    lowerIsBetter: false,
    icon: Wallet
  },
  {
    label: "Net Cashflow",
    value: summary.totals.netCashflow,
    previous: summary.comparison.netCashflow,
    lowerIsBetter: false,
    icon: TrendUp
  },
  {
    label: "Daily Average Spend",
    value: summary.totals.dailyAverage,
    previous: summary.comparison.dailyAverage,
    lowerIsBetter: true,
    icon: Gauge
  }
] : [];
```

Replace the selector options:

```tsx
<option value="current">Current Cycle</option>
<option value="previous">Previous Cycle</option>
```

Update the live-region text to the same labels.

Use the supplied values directly:

- `summary.dailySpend`
- `summary.categories`
- `summary.budgets`
- `summary.recentTransactions`
- `summary.alert`

Set the alert consumed by the guidance card with:

```ts
const latestAlert = summary?.alert ?? null;
```

Remove `transactionError`, `budgetError`, `guidanceError`, and every partial-error branch.

For nullable transaction fields render:

```tsx
<td className="p-1.5">{transaction.merchant ?? "Unknown merchant"}</td>
<td className="p-1.5">{transaction.category ?? "Uncategorized"}</td>
```

Derive the deterministic insight without another API:

```ts
const highestCategory = summary?.categories[0] ?? null;
const insight = highestCategory
  ? `${highestCategory.category} ${period === "current" ? "is" : "was"} your largest expense at ${highestCategory.percent}% of spending.`
  : "There is not enough activity to form an insight.";
```

Use `summary.hasTransactions ? insight : "No transactions for this period."`.

- [ ] **Step 5: Delete the fixture module**

Delete:

```txt
src/lib/fixtures.ts
```

Verify no fixture import remains:

```bash
rg -n "fixtures|createFixture|DemoState|requestedState" src tests
```

Expected: no runtime fixture or demo-state reference.

- [ ] **Step 6: Run UI, display, and static tests**

Run:

```bash
npm test -- tests/static.test.mjs tests/dashboard-display.test.mjs tests/finance.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit the cycle-based dashboard**

```bash
git add src/app/dashboard/page.tsx src/components/overview-dashboard.tsx src/lib/fixtures.ts tests/static.test.mjs
git commit -m "feat: render Nexus Core financial cycles"
```

---

### Task 3: Configure runtime integration and verify the build

**Files:**
- Create: `.env.example`
- Modify: `docker-compose.yaml`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Produces: `NEXUS_CORE_URL`
- Produces: `CORE_API_KEY`
- Produces: `VEYRA_TELEGRAM_USER_ID`
- Produces: `VEYRA_USER_ID`
- Consumes: external Docker network `veyra-network`

- [ ] **Step 1: Add failing configuration assertions**

Append to `tests/static.test.mjs`:

```js
test("documents and supplies the server-side Nexus Core environment", async () => {
  const [example, compose] = await Promise.all([
    readSource(".env.example"),
    readSource("docker-compose.yaml")
  ]);

  for (const name of [
    "NEXUS_CORE_URL",
    "CORE_API_KEY",
    "VEYRA_TELEGRAM_USER_ID",
    "VEYRA_USER_ID"
  ]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.match(compose, new RegExp(name));
  }

  assert.match(example, /^VEYRA_TELEGRAM_USER_ID=976684739$/m);
  assert.match(example, /^VEYRA_USER_ID=1$/m);
  assert.match(compose, /http:\/\/core-api:3000/);
  assert.match(compose, /veyra-network/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_/);
});
```

- [ ] **Step 2: Run the configuration test and confirm it fails**

Run:

```bash
npm test -- tests/static.test.mjs
```

Expected: FAIL because `.env.example` does not exist and Compose does not pass the four values.

- [ ] **Step 3: Document the dashboard environment**

Create `.env.example`:

```txt
NEXUS_CORE_URL=http://core-api:3000
CORE_API_KEY=
VEYRA_TELEGRAM_USER_ID=976684739
VEYRA_USER_ID=1
```

Do not place a real API key in the repository.

- [ ] **Step 4: Pass the environment through Docker Compose**

Add this block to the existing `veyra` service in `docker-compose.yaml`:

```yaml
    environment:
      - NEXUS_CORE_URL=${NEXUS_CORE_URL:-http://core-api:3000}
      - CORE_API_KEY=${CORE_API_KEY:-}
      - VEYRA_TELEGRAM_USER_ID=${VEYRA_TELEGRAM_USER_ID:-976684739}
      - VEYRA_USER_ID=${VEYRA_USER_ID:-1}
```

Keep the existing port binding and external `veyra-network`.

- [ ] **Step 5: Validate tests and Compose configuration**

Run:

```bash
npm test
docker compose config
```

Expected:

- All Node tests pass.
- Compose resolves the Veyra service with `NEXUS_CORE_URL=http://core-api:3000`.
- No real API key appears in tracked files or command output.

- [ ] **Step 6: Run type checking through the production build**

Run:

```bash
npm run build
```

Expected: Next.js production build completes without contacting Nexus Core.

- [ ] **Step 7: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected:

- No whitespace errors.
- Only the planned dashboard integration files are changed.
- `src/lib/fixtures.ts` is deleted.
- No `.env`, API key, response payload, or unrelated file is tracked.

- [ ] **Step 8: Commit runtime configuration**

```bash
git add .env.example docker-compose.yaml tests/static.test.mjs
git commit -m "chore: configure Nexus Core dashboard access"
```

---

## Deferred integration smoke test

Run only after the Core API endpoint and its `alert` field are available:

```bash
curl --fail --silent --show-error \
  -X POST "${NEXUS_CORE_URL}/api/veyra/dashboard/overview" \
  -H "content-type: application/json" \
  -H "x-core-api-key: ${CORE_API_KEY}" \
  -d '{
    "telegramUserId": "976684739",
    "userId": 1,
    "asOfDate": "2026-07-25",
    "timezone": "Asia/Jakarta"
  }'
```

Then refresh `/dashboard` and verify:

1. `Current Cycle` and `Previous Cycle` render the matching API boundaries.
2. Metrics, chart, categories, budgets, transactions, alert, and insight change together.
3. Income and expense signs are correct.
4. Empty data is not presented as a failure.
5. Stopping Core API produces the retry state without exposing an error body or API key.
