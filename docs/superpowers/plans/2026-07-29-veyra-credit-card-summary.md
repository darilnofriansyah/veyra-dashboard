# Veyra Credit Card Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one combined credit-card usage and full statement balance for each dashboard cycle, plus a ready-to-run Core API Codex prompt.

**Architecture:** Extend each existing `PeriodOverview` with one required `creditCard` object. Validate it in the existing server loader, derive usage percentage in one tested display helper, and render one full-width panel using the selected period.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Node test runner

## Global Constraints

- Keep `POST /api/veyra/dashboard/overview` as the only dashboard data request.
- Use one combined summary per user and cycle; never add a card array.
- Contract fields are `limit`, `used`, and `statementBalance`.
- Treat all values as non-negative, safe IDR integers.
- Render zero values as `IDR 0` and usage as `0%`.
- Add no dependency, endpoint, route, due date, minimum payment, or client state.

---

### Task 1: Extend and validate the overview contract

**Files:**
- Modify: `tests/overview-loader.test.ts`
- Modify: `src/lib/finance.ts`
- Modify: `src/lib/overview-loader.ts`

**Interfaces:**
- Produces: `CreditCardSummary`
- Produces: `PeriodOverview.creditCard: CreditCardSummary`
- Consumes: Core API `current.creditCard` and `previous.creditCard`

- [ ] **Step 1: Add failing loader contract cases**

Add a complete credit-card object to the `period` fixture:

```ts
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
  // existing fields
  creditCard
});
```

Pass `{ limit: 0, used: 0, statementBalance: 0 }` to the previous-cycle fixture
so the existing deep-equality assertion proves zero values survive parsing.

Add malformed cases:

```ts
["missing credit card", () => {
  const body = structuredClone(validResponse) as Record<string, unknown>;
  delete (body.current as Record<string, unknown>).creditCard;
  return Response.json(body);
}],
["negative statement balance", () => {
  const body = structuredClone(validResponse);
  body.current.creditCard.statementBalance = -1;
  return Response.json(body);
}]
```

- [ ] **Step 2: Run the loader test and verify RED**

Run:

```bash
node --test tests/overview-loader.test.ts
```

Expected: valid-response deep equality fails because parsed periods omit
`creditCard`; malformed missing data is incorrectly accepted.

- [ ] **Step 3: Add the minimal shared type and parser**

In `src/lib/finance.ts`:

```ts
export interface CreditCardSummary {
  limit: number;
  used: number;
  statementBalance: number;
}
```

Add `creditCard: CreditCardSummary` to `PeriodOverview`.

In `src/lib/overview-loader.ts`, import the type and add:

```ts
function parseCreditCard(value: unknown, name: string): CreditCardSummary {
  const item = object(value, name);
  return {
    limit: rupiah(item.limit, `${name}.limit`),
    used: rupiah(item.used, `${name}.used`),
    statementBalance: rupiah(
      item.statementBalance,
      `${name}.statementBalance`
    )
  };
}
```

Add this field to `parsePeriodOverview`:

```ts
creditCard: parseCreditCard(item.creditCard, `${name}.creditCard`),
```

- [ ] **Step 4: Run the loader test and verify GREEN**

Run:

```bash
node --test tests/overview-loader.test.ts
```

Expected: all loader tests pass.

- [ ] **Step 5: Commit the contract**

```bash
git add tests/overview-loader.test.ts src/lib/finance.ts src/lib/overview-loader.ts
git commit -m "feat: accept credit card summaries"
```

### Task 2: Render approved credit-card panel

**Files:**
- Modify: `tests/finance.test.ts`
- Modify: `tests/static.test.mjs`
- Modify: `src/lib/finance.ts`
- Modify: `src/components/overview-dashboard.tsx`

**Interfaces:**
- Consumes: selected `PeriodOverview.creditCard`
- Produces: `creditUsagePercent(used: number, limit: number): number`
- Produces: accessible `Credit Card` panel below `Financial health`

- [ ] **Step 1: Add failing percentage behavior tests**

In `tests/finance.test.ts`, import `creditUsagePercent` and add:

```ts
test("credit usage handles zero limits and preserves over-limit usage", () => {
  assert.equal(creditUsagePercent(0, 0), 0);
  assert.equal(creditUsagePercent(4_700_000, 10_000_000), 47);
  assert.equal(creditUsagePercent(11_000_000, 10_000_000), 110);
});
```

Add one static hierarchy check in `tests/static.test.mjs`:

```js
test("renders one period-owned accessible credit card summary", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label="Credit card"/);
  assert.match(dashboard, /Amount to Pay/);
  assert.match(dashboard, /Credit Used/);
  assert.match(dashboard, /summary\.creditCard\.statementBalance/);
  assert.match(dashboard, /summary\.creditCard\.used/);
  assert.match(dashboard, /summary\.creditCard\.limit/);
  assert.match(dashboard, /aria-label=\{`Credit card used:/);
  assert.ok(
    dashboard.indexOf('aria-label="Financial health"')
      < dashboard.indexOf('aria-label="Credit card"')
  );
});
```

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
node --test tests/finance.test.ts tests/static.test.mjs
```

Expected: module import fails because `creditUsagePercent` does not exist.

- [ ] **Step 3: Add minimal percentage helper**

In `src/lib/finance.ts`:

```ts
export function creditUsagePercent(used: number, limit: number) {
  return limit === 0 ? 0 : Math.round((used / limit) * 100);
}
```

- [ ] **Step 4: Render layout A**

Import `CreditCard` and `creditUsagePercent`. After `summary` is selected, add:

```ts
const creditUsage = summary
  ? creditUsagePercent(summary.creditCard.used, summary.creditCard.limit)
  : 0;
```

Immediately after the `Financial health` section, render:

```tsx
<section
  aria-label="Credit card"
  className={`${panel} mt-2.5 border-l-[3px] border-l-veyra-cyan`}
>
  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
    <CreditCard
      size={16}
      weight="duotone"
      aria-hidden="true"
      className="text-veyra-cyan"
    />
    Credit Card
  </h2>
  <div className="grid gap-3 md:grid-cols-2">
    <div>
      <span className={label}>Amount to Pay</span>
      <strong className={value}>
        {formatIdr(summary.creditCard.statementBalance)}
      </strong>
    </div>
    <div>
      <span className={label}>Credit Used</span>
      <strong className={value}>{formatIdr(summary.creditCard.used)}</strong>
    </div>
  </div>
  <progress
    max="100"
    value={Math.min(creditUsage, 100)}
    aria-label={`Credit card used: ${formatIdr(summary.creditCard.used)} of ${formatIdr(summary.creditCard.limit)}, ${creditUsage}%`}
    className="budget-progress mt-3 h-1.5 w-full"
  >
    {creditUsage}%
  </progress>
  <span className="mt-1.5 block text-xs text-slate-500">
    {creditUsage}% of {formatIdr(summary.creditCard.limit)} limit
  </span>
</section>
```

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run:

```bash
node --test tests/finance.test.ts tests/static.test.mjs
```

Expected: all targeted tests pass.

- [ ] **Step 6: Commit the panel**

```bash
git add tests/finance.test.ts tests/static.test.mjs src/lib/finance.ts src/components/overview-dashboard.tsx
git commit -m "feat: show credit card cycle summary"
```

### Task 3: Add Core API Codex prompt

**Files:**
- Create: `docs/prompts/core-api-credit-card-dashboard.md`

**Interfaces:**
- Produces: standalone implementation prompt for the Core API repository
- Consumes: exact Veyra `creditCard` response contract

- [ ] **Step 1: Write the prompt**

Include:

````md
# Codex prompt: add combined credit-card data to Core API dashboard

Sync with `origin/main` before editing without discarding local work. Inspect
repository rules, current dashboard endpoint, cycle calculation, persistence,
migrations, and tests before choosing files.

Extend `POST /api/veyra/dashboard/overview` so both `current` and `previous`
contain:

```ts
creditCard: {
  limit: number;
  used: number;
  statementBalance: number;
}
```

Implement one combined summary per user and billing cycle, never one record per
card and never an array. Use non-negative safe IDR integers. Return all zeros
when no summary exists. Add the smallest database uniqueness constraint matching
existing schema conventions. Preserve current auth, timezone, cycle boundaries,
and all existing response fields.

Use repository-standard test-first workflow. Cover persistence, uniqueness,
current/previous cycle mapping, zero fallback, invalid amounts, endpoint response
shape, full tests, lint/typecheck, and build. Add no speculative card metadata,
minimum payments, due dates, percentage storage, or new endpoint.
````

- [ ] **Step 2: Review prompt against Veyra contract**

Confirm exact property names, required zero fallback, one-summary rule, and both
periods match this plan. Human-facing prompt needs no source-grep test.

- [ ] **Step 3: Commit the prompt**

```bash
git add docs/prompts/core-api-credit-card-dashboard.md
git commit -m "docs: add Core API credit card prompt"
```

### Task 4: Verify complete feature

**Files:**
- Verify all modified files

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: zero failures.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 3: Check final diff**

```bash
git diff origin/main...HEAD --check
git status --short
```

Expected: no whitespace errors; worktree clean after task commits.
