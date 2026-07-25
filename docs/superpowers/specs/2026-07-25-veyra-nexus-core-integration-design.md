# Veyra Nexus Core Integration Design

**Date:** 2026-07-25
**Status:** Approved for implementation planning
**Surface:** Authenticated Overview dashboard

## 1. Purpose

Replace the dashboard's local financial fixtures with real data from Nexus Core while preserving the existing read-only Overview experience.

The dashboard will consume the in-progress `POST /api/veyra/dashboard/overview` endpoint. Nexus Core remains responsible for user resolution, financial-cycle boundaries, transaction filtering, aggregation, budget hierarchy, and comparison calculations. The dashboard remains responsible for presentation, period selection, IDR formatting, retry interaction, and the short deterministic Veyra observation.

## 2. API dependency

The integration expects this server-to-server request:

```http
POST /api/veyra/dashboard/overview
content-type: application/json
x-core-api-key: <server-only value>
```

```json
{
  "telegramUserId": "976684739",
  "userId": 1,
  "asOfDate": "2026-07-25",
  "timezone": "Asia/Jakarta"
}
```

The response contains `current` and `previous` cycle summaries. Each summary contains its period boundary, transaction presence, totals, comparison totals, daily expense points, category totals, budget rows, and recent transactions.

One addition is required to the previously proposed response contract:

```json
{
  "alert": {
    "category": "Food",
    "limit": 1500000,
    "spent": 1575000,
    "percent": 105,
    "status": "over"
  }
}
```

`alert` is nullable and must be calculated across every active budget before Nexus Core limits `budgets` to the four display rows. This prevents the dashboard from missing an over-budget category that is not in the visible four.

## 3. Architecture

```text
Dashboard Server Component
          |
          v
src/lib/overview-loader.ts
  - reads server-only environment
  - POSTs one no-store request
  - validates and maps the response
          |
          v
Nexus Core dashboard overview endpoint
          |
          v
OverviewDashboard client component
  - switches between supplied periods
  - renders the existing dashboard
```

The App Router page remains request-time rendered. Current Next.js 16 guidance supports calling `fetch()` from an async Server Component with `cache: "no-store"` for per-request data and reading non-public environment variables directly on the server.

No browser request, Next.js proxy route, state library, data-fetching library, or new dependency is needed.

## 4. Environment contract

The dashboard uses these server-only variables:

```txt
NEXUS_CORE_URL=http://core-api:3000
CORE_API_KEY=
VEYRA_TELEGRAM_USER_ID=976684739
VEYRA_USER_ID=1
```

- `NEXUS_CORE_URL` identifies the Core API container or deployment.
- `CORE_API_KEY` is sent only as `x-core-api-key` from the Next.js server.
- `VEYRA_TELEGRAM_USER_ID` defaults to `976684739`.
- `VEYRA_USER_ID` defaults to `1`.
- Neither the key nor the identity values use a `NEXT_PUBLIC_` prefix.

Docker Compose passes these values to the Veyra service. The existing external `veyra-network` lets the dashboard reach `http://core-api:3000` without exposing Core API to the browser.

## 5. Dashboard data model

The dashboard adopts the API response as its source model instead of reconstructing summaries from raw fixtures.

```ts
type Period = "current" | "previous";
type BudgetStatus = "on-track" | "warning" | "over";

interface PeriodOverview {
  period: {
    label: "current_cycle" | "previous_cycle";
    start: string;
    end: string;
  };
  hasTransactions: boolean;
  totals: {
    income: number;
    spent: number;
    netCashflow: number;
    dailyAverage: number;
  };
  comparison: {
    income: number;
    spent: number;
    netCashflow: number;
    dailyAverage: number;
  };
  dailySpend: Array<{ date: string; amount: number }>;
  categories: Array<{
    category: string;
    amount: number;
    percent: number;
    transactionCount: number;
  }>;
  budgets: Array<{
    category: string;
    limit: number;
    spent: number;
    percent: number;
    status: BudgetStatus;
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    merchant: string | null;
    category: string | null;
    amount: number;
    type: "income" | "expense";
  }>;
  alert: {
    category: string;
    limit: number;
    spent: number;
    percent: number;
    status: BudgetStatus;
  } | null;
}
```

The response parser validates identifiers, ISO dates, finite non-negative amounts, percentages, transaction types, budget statuses, and required nested objects. Malformed payloads are treated as a failed request rather than rendered as financial data.

## 6. UI behavior

The period selector remains the only client state. Its labels change to:

- `Current Cycle`
- `Previous Cycle`

Selecting a period chooses `response.current` or `response.previous`; it does not make another request.

The account-cycle label is derived from the selected response's `start` and exclusive `end` boundaries. The metrics use `totals` and `comparison`. Charts, categories, budgets, recent transactions, and alert use their matching period summary.

The Veyra insight remains deterministic: the first category returned by the API becomes the largest-expense observation. No LLM call is added.

`formatIdr`, chart layout, percentage comparison display, and accessible visual components remain in the dashboard. Fixture creation and client-side financial aggregation are removed.

## 7. Loading, empty, and error behavior

- `src/app/dashboard/loading.tsx` remains the route-level loading state.
- A successful empty response renders dashes and the existing period-neutral empty copy.
- A network error, timeout, non-2xx response, or malformed payload produces one unavailable financial-summary state.
- Retry continues to call `router.refresh()`, causing the server loader to run again.
- The API key, request headers, full financial response, and error response body are never logged or sent to the client.
- The request uses a short abort timeout so a stalled Core API does not hold the page indefinitely.

The old fixture-only partial transaction and budget failures are removed because the new API is one aggregate request with one success boundary.

## 8. File changes

| Path | Change |
|---|---|
| `.env.example` | Document server-only Core API and default identity variables |
| `docker-compose.yaml` | Pass Core API URL, key, and identity values to the Veyra container |
| `src/lib/overview-loader.ts` | Replace fixtures with the authenticated no-store Core API request and response validation |
| `src/lib/finance.ts` | Keep shared display types and `formatIdr`; remove fixture aggregation |
| `src/app/dashboard/page.tsx` | Load one real overview response for the Jakarta request date |
| `src/components/overview-dashboard.tsx` | Select API-provided cycle summaries and render the single error boundary |
| `tests/overview-loader.test.ts` | Mock `fetch` and verify request, defaults, parsing, and failures |
| `tests/finance.test.ts` | Retain only display-formatting tests still owned by the dashboard |
| `tests/static.test.mjs` | Replace fixture/month assertions with Core API/cycle assertions |
| `src/lib/fixtures.ts` | Delete |

No visual component or asset changes are required.

## 9. Testing

The smallest useful test set covers:

1. The loader sends one POST with `cache: "no-store"`, JSON content type, API key, Jakarta date, and configured/default identities.
2. The loader accepts a valid current/previous response and rejects malformed nested values.
3. Network failures, aborts, and non-2xx responses map to the dashboard error result without exposing response bodies.
4. The client selects the matching supplied period and uses API period boundaries.
5. Static checks confirm fixtures are gone, secrets stay server-only, cycle labels replace month labels, retry remains available, and accessibility behavior is preserved.
6. The full Node test suite and production build pass without a running Core API.

An integration smoke test against the real endpoint is deferred until the Core API work lands. It will use the default Telegram ID `976684739` and user ID `1`.

## 10. Alternatives rejected

### Multiple conversational API calls

Calling `/api/veyra/conversational/handle` for each card and chart would add latency, partial contract handling, and Telegram-oriented coupling.

### Browser-side fetching

This would expose the Core API key and create unnecessary CORS and client-loading complexity.

### Next.js proxy route

The dashboard has no browser consumer that needs a proxy. The Server Component can call Core API directly.
