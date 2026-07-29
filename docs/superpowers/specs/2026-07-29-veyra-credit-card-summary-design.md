# Veyra Credit Card Summary Design

**Date:** 2026-07-29  
**Status:** Approved for implementation planning  
**Surface:** Authenticated Overview dashboard

## Purpose

Add one combined credit-card summary to each dashboard cycle so users can see
total credit usage and the full statement amount to pay. Preserve the existing
single-request, read-only dashboard flow.

## API contract

`POST /api/veyra/dashboard/overview` adds one required `creditCard` object to
both `current` and `previous`:

```ts
creditCard: {
  limit: number;
  used: number;
  statementBalance: number;
}
```

All values are non-negative, safe IDR integers:

- `limit`: combined credit limit.
- `used`: combined credit currently used for the selected cycle.
- `statementBalance`: full amount billed when that cycle closes.

The database and API support one combined summary per user and cycle, never a
card list. Zero values represent missing or unused credit-card data. Percentage
is derived by Veyra and is not stored or returned.

No relation such as `used <= limit` is enforced because over-limit usage is
valid. When `limit` is zero, Veyra displays `0%`.

## Data flow

The existing server-side `loadOverview` request remains the only request.
`src/lib/overview-loader.ts` validates `creditCard` beside each period summary.
The existing `Current Cycle` / `Previous Cycle` selector selects the matching
object without another request or client state.

Invalid or missing credit-card fields use the existing aggregate dashboard
error state and retry behavior.

## UI

Use approved layout A: one full-width `Credit Card` panel immediately below the
four financial-health cards.

The panel contains:

- `Amount to Pay`: formatted `statementBalance`, visually primary.
- `Credit Used`: formatted `used`.
- A usage progress bar.
- Copy in the form `47% of IDR 10,000,000 limit`.

Usage percentage is `(used / limit) * 100`, rounded for display. The visible
percentage may exceed 100; the native progress value is capped at 100. The
progress bar has an accessible label containing used amount, limit, and
percentage.

All-zero data keeps the panel visible and renders `IDR 0` with `0%`.

## Core API Codex prompt

Add `docs/prompts/core-api-credit-card-dashboard.md`. The prompt instructs a
Codex session in the Core API repository to:

- inspect existing dashboard, persistence, migration, and test patterns first;
- support one combined credit-card summary per user and cycle;
- extend both overview periods with the exact required contract;
- return zeros when no summary exists;
- preserve authentication, timezone, and cycle-boundary behavior;
- add the smallest database constraint that prevents multiple summaries for the
  same user and cycle;
- test persistence, aggregation, zero fallback, and dashboard response shape.

The prompt must not prescribe framework-specific filenames or commands that
cannot be verified from this repository.

## Veyra file changes

- `src/lib/finance.ts`: add the shared credit-card type and period field.
- `src/lib/overview-loader.ts`: validate the required object and amounts.
- `src/components/overview-dashboard.tsx`: render layout A.
- `tests/overview-loader.test.ts`: cover valid, zero, missing, and malformed
  values.
- `tests/static.test.mjs`: cover placement, labels, period-owned data, and
  accessibility.
- `docs/prompts/core-api-credit-card-dashboard.md`: add Core API implementation
  prompt.

No dependency, endpoint, route, client request, due date, minimum payment, card
list, or new state is added.

## Verification

Implementation uses a test-first cycle. Completion requires:

1. Targeted loader and static tests pass.
2. Full `npm test` passes.
3. Production `npm run build` passes.
4. Final diff contains only the approved Veyra changes and Core API prompt.
