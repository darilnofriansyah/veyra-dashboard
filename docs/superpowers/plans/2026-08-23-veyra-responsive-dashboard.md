# Veyra Responsive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` to implement this plan task-by-task.
> Main execution orchestrator must use `gpt-5.6-terra` with `high` reasoning.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve hierarchy and mobile usability across Overview, Transactions,
Pockets, shared navigation, dialogs, and loading states without changing Core or
authentication behavior.

**Architecture:** Keep current page components and server/client boundaries.
Use responsive Tailwind rendering inside existing components: desktop tables
and sidebar remain, while mobile gets a shared bottom navigation, compact
financial hierarchy, semantic record lists, native disclosures, and safe-area
sheets. Reuse current data and server actions; add no dependency.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, native HTML
`dialog`/`details`, Phosphor Icons, Node.js test runner.

**Spec:**
`docs/superpowers/specs/2026-08-23-veyra-responsive-dashboard-design.md`

## Execution Orchestration

- Main orchestrator: `gpt-5.6-terra`, reasoning `high`.
- Dispatch one fresh worker per task through
  `superpowers:subagent-driven-development`.
- Run specification review, then code-quality review after each task.
- Workers may edit only task-listed files. Preserve unrelated untracked files.
- Do not commit unless user separately authorizes commits. If authorized, stage
  only explicit task paths; never use broad staging.

## Global Constraints

- Core remains authoritative. No endpoint, request, response, validation, or
  financial calculation changes.
- Core API communication and credentials remain server-side.
- Preserve Telegram OIDC, Mini App authentication, safe-area runtime variables,
  and route protection.
- Preserve Asia/Jakarta semantics and existing full-IDR formatter.
- Keep current system-sans font. B-004 owns final font/brand replacement.
- Cyan is sole non-semantic accent. Status colors remain semantic exceptions.
- No new package, chart library, state library, or motion library.
- No page-level horizontal overflow at 320px and wider.
- Preserve zoom, visible focus, semantic controls, live regions, empty/error
  truthfulness, reduced motion, and keyboard operation.
- Do not run `npm run build`, Docker builds, deployments, or service restarts.

## File Map

- `BACKLOG.md` — activate and later close responsive dashboard work.
- `src/components/app-shell.tsx` — shared desktop/mobile navigation and account
  context.
- `src/app/globals.css` — shared responsive shell, touch, safe-area, and dialog
  sheet rules.
- `src/components/overview-dashboard.tsx` — Financial Pulse, content order, and
  mobile recent-transaction list.
- `src/components/category-breakdown.tsx` — cyan/navy/slate category palette.
- `src/components/transactions-page.tsx` — desktop table, mobile records, and
  responsive filters.
- `src/components/pockets-page.tsx` — divided pocket list and mobile actions.
- `src/components/transaction-edit-dialog.tsx` — dirty-close protection and
  form metadata.
- `src/components/pocket-dialog.tsx` — mobile sheet and live error status.
- `src/app/{dashboard,transactions,pockets}/loading.tsx` — responsive skeletons.
- `tests/static.test.mjs` — source-level responsive/accessibility contracts.
- `tests/telegram-mini-app.test.mjs` — generic plus Telegram safe-area shell
  contracts.
- `design-qa.md` — final browser evidence only.

---

### Task 1: Activate Work and Build Shared Responsive Shell

**Files:**
- Modify: `BACKLOG.md`
- Modify: `src/components/app-shell.tsx:20-89`
- Modify: `src/app/globals.css:1-142`
- Modify: `tests/static.test.mjs`
- Modify: `tests/telegram-mini-app.test.mjs`

**Interfaces:**
- Consumes: existing `AppShellProps`, `activePage`, Telegram CSS variables.
- Produces: `.app-mobile-header`, `.app-sidebar`, `.app-nav`, and shared mobile
  bottom-navigation behavior used by all pages and loading routes.

- [ ] **Step 1: Add active backlog item**

Add under `## Current work`, before B-005:

```markdown
### B-006 — Refresh responsive dashboard design

- **Status:** Active; implementation planned on 2026-08-23.
- **Evidence:** Design and implementation plan are recorded in
  `docs/superpowers/specs/2026-08-23-veyra-responsive-dashboard-design.md` and
  `docs/superpowers/plans/2026-08-23-veyra-responsive-dashboard.md`.
- **Dependencies:** Authenticated controllable browser environment for final
  responsive and Telegram QA.
- **Complete when:** Automated tests pass and normal-browser plus Telegram checks
  pass at the viewports listed in the design spec, including 200% text zoom,
  keyboard focus, loading/error states, and no page-level horizontal overflow.
```

Update B-005 completion text: replace `horizontal scrolling` with
`responsive transaction table/list switching` because this plan removes the
mobile table-scroll requirement.

- [ ] **Step 2: Add failing shared-shell tests**

Append to `tests/static.test.mjs`:

```js
test("shares one safe mobile navigation across browser and Telegram", async () => {
  const [shell, css] = await Promise.all([
    readSource("src/components/app-shell.tsx"),
    readSource("src/app/globals.css")
  ]);

  assert.match(shell, /app-mobile-header/);
  assert.match(shell, /app-sidebar/);
  assert.match(shell, /app-nav/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.app-shell[\s\S]*padding-bottom:/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /\.app-sidebar[\s\S]*position:\s*fixed/);
  assert.match(css, /\.app-nav[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.doesNotMatch(css, /transition:\s*all/);
});
```

Extend `tests/telegram-mini-app.test.mjs` narrow-shell test:

```js
assert.match(css, /html\[data-telegram-mini-app="true"\] \.app-mobile-header/);
assert.match(css, /--veyra-telegram-safe-bottom/);
```

- [ ] **Step 3: Run targeted tests and confirm failure**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/telegram-mini-app.test.mjs
```

Expected: FAIL on missing `.app-mobile-header` and generic fixed mobile shell.

- [ ] **Step 4: Refactor `AppShell` without changing its public props**

Keep one `nav`; add a compact header before `aside`. Use existing account data
and logout action:

```tsx
<header className="app-mobile-header flex min-w-0 items-center justify-between gap-3 border-b border-veyra-line bg-white px-4 py-3 xl:hidden">
  <Image
    src="/assets/veyra-logo.png"
    width={840}
    height={194}
    sizes="112px"
    alt="Veyra"
    className="h-auto w-28"
    preload
  />
  <div className="flex min-w-0 items-center gap-2">
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-veyra-navy text-xs font-semibold text-white">
      {initials}
    </span>
    <div className="min-w-0 text-right">
      <strong className="block truncate text-sm">{accountName}</strong>
      <form action={logout}>
        <button type="submit" className="text-xs font-semibold text-sky-700 transition-colors hover:text-veyra-navy active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none">
          Sign Out
        </button>
      </form>
    </div>
  </div>
</header>
```

Keep current desktop `aside` account section and navigation markup. Add
`hidden xl:block` to its brand and `hidden xl:flex` to its account section. Add
`sm:grid-cols-3 xl:grid-cols-1` to nav so 768–1199px uses one horizontal row;
CSS turns that same nav into fixed bottom navigation below 768px.

- [ ] **Step 5: Replace Telegram-only narrow navigation CSS with generic rules**

Add base interaction rules:

```css
@layer base {
  button, a, select, summary { touch-action: manipulation; }
  button, a, summary { -webkit-tap-highlight-color: rgb(0 179 255 / 12%); }
  h1, h2 { text-wrap: balance; }
  p { text-wrap: pretty; }
}

@media (prefers-reduced-motion: no-preference) {
  button:active, a:active, summary:active { transform: translateY(1px); }
}
```

At `max-width: 767px`, make `.app-sidebar` fixed bottom navigation, hide its
brand/account, reserve shell bottom space, and use generic safe area:

```css
@media (max-width: 767px) {
  .app-shell {
    padding-bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px));
  }

  .app-sidebar {
    position: fixed;
    z-index: 40;
    right: 0;
    bottom: 0;
    left: 0;
    display: block;
    padding: 0.375rem 0.5rem env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--color-veyra-line);
    border-bottom: 0;
    background: white;
  }

  .app-sidebar .app-brand,
  .app-sidebar .app-account { display: none; }

  .app-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    gap: 0.25rem;
  }

  .app-nav a {
    min-height: 3.5rem;
    justify-content: center;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.375rem 0.25rem;
    border-left-width: 0;
    border-bottom: 3px solid transparent;
  }

  .app-nav a[aria-current="page"] {
    border-bottom-color: var(--color-veyra-cyan);
  }

  html[data-telegram-mini-app="true"] .app-shell {
    padding-bottom: calc(4.25rem + var(--veyra-telegram-safe-bottom));
  }

  html[data-telegram-mini-app="true"] .app-sidebar {
    padding-bottom: var(--veyra-telegram-safe-bottom);
  }

  html[data-telegram-mini-app="true"] .app-mobile-header { display: none; }
}
```

Delete duplicated Telegram-only nav declarations now covered by generic rules.
Keep Telegram stable-height and dialog safe-area declarations.

- [ ] **Step 6: Run tests and inspect diff**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/telegram-mini-app.test.mjs
rtk git diff --check
rtk git diff -- BACKLOG.md src/components/app-shell.tsx src/app/globals.css tests/static.test.mjs tests/telegram-mini-app.test.mjs
```

Expected: targeted tests PASS; no whitespace errors; no auth/runtime changes.

---

### Task 2: Build Financial Pulse and Mobile Overview Hierarchy

**Files:**
- Modify: `src/components/overview-dashboard.tsx:14-237`
- Modify: `src/components/category-breakdown.tsx:3-27`
- Modify: `src/app/globals.css:8`
- Modify: `src/app/dashboard/loading.tsx`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: unchanged `OverviewLoaderResult`, `comparison()`, `formatIdr()`,
  `creditUsagePercent()`, `SpendingTrend`, and `CategoryBreakdown`.
- Produces: one `aria-label="Financial pulse"` section and responsive recent
  transaction table/list views.

- [ ] **Step 1: Add failing Overview structure tests**

Append:

```js
test("prioritizes one responsive financial pulse", async () => {
  const [dashboard, categories, loading] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/components/category-breakdown.tsx"),
    readSource("src/app/dashboard/loading.tsx")
  ]);

  assert.equal([...dashboard.matchAll(/aria-label="Financial pulse"/g)].length, 1);
  assert.ok(dashboard.indexOf("Net Cashflow") < dashboard.indexOf("Total Income"));
  assert.ok(dashboard.indexOf("Latest Alert") < dashboard.indexOf("Spending Trend"));
  assert.match(dashboard, /overview-recent-mobile/);
  assert.match(dashboard, /overview-recent-desktop/);
  assert.doesNotMatch(categories, /#A64DFF|#6D79D8/);
  assert.doesNotMatch(await readSource("src/app/globals.css"), /veyra-purple/);
  assert.match(loading, /aria-label="Loading financial pulse"/);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs
```

Expected: FAIL on missing Financial Pulse and old purple colors.

- [ ] **Step 3: Replace equal KPI grid and credit panel with one pulse**

Remove the `metrics` array. Compute four comparisons once:

```tsx
const neutralDelta = { text: "No activity", className: "text-slate-500" };
const spentDelta = summary
  ? comparison(summary.totals.spent, summary.comparison.spent, true)
  : neutralDelta;
const incomeDelta = summary
  ? comparison(summary.totals.income, summary.comparison.income, false)
  : neutralDelta;
const cashflowDelta = summary
  ? comparison(summary.totals.netCashflow, summary.comparison.netCashflow, false)
  : neutralDelta;
const averageDelta = summary
  ? comparison(summary.totals.dailyAverage, summary.comparison.dailyAverage, true)
  : neutralDelta;
```

Render one asymmetric section after period output:

```tsx
<section aria-label="Financial pulse" className={`${panel} grid gap-5 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]`}>
  <div className="min-w-0">
    <span className={label}>Net Cashflow</span>
    <strong className="mt-1 block text-3xl font-bold tracking-[-0.05em] tabular-nums text-veyra-ink">
      {summary.hasTransactions ? formatIdr(summary.totals.netCashflow) : "—"}
    </strong>
    <span className={`mt-1.5 block text-xs ${cashflowDelta.className}`}>
      {summary.hasTransactions ? cashflowDelta.text : "No activity"}
    </span>
    <div className="mt-5 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
      <div className="min-w-0">
        <span className={label}>Total Income</span>
        <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.income) : "—"}</strong>
        <span className={`mt-1.5 block text-xs ${incomeDelta.className}`}>{summary.hasTransactions ? incomeDelta.text : "No activity"}</span>
      </div>
      <div className="min-w-0">
        <span className={label}>Total Spent</span>
        <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.spent) : "—"}</strong>
        <span className={`mt-1.5 block text-xs ${spentDelta.className}`}>{summary.hasTransactions ? spentDelta.text : "No activity"}</span>
      </div>
    </div>
    <div className="mt-4 border-t border-veyra-line pt-3">
      <span className={label}>Daily Average Spend</span>
      <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.dailyAverage) : "—"}</strong>
      <span className={`mt-1.5 block text-xs ${averageDelta.className}`}>{summary.hasTransactions ? averageDelta.text : "No activity"}</span>
    </div>
  </div>
  <section aria-label="Credit card" className="min-w-0 border-t border-veyra-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
    <h2 className="flex items-center gap-2 text-sm font-bold">
      <CreditCard size={16} weight="duotone" aria-hidden="true" className="text-veyra-cyan" />
      Credit Card
    </h2>
    <span className={`${label} mt-4 block`}>Amount to Pay</span>
    <strong className="mt-1 block text-2xl font-bold tracking-[-0.04em] tabular-nums text-veyra-ink">{formatIdr(summary.creditCard.statementBalance)}</strong>
    <span className={`${label} mt-4 block`}>Credit Used</span>
    <strong className={value}>{formatIdr(summary.creditCard.used)}</strong>
    <progress max="100" value={Math.min(creditUsage, 100)} aria-label={`Credit card used: ${formatIdr(summary.creditCard.used)} of ${formatIdr(summary.creditCard.limit)}, ${creditUsage}%`} className="budget-progress mt-3 h-1.5 w-full">{creditUsage}%</progress>
    <span className="mt-1.5 block text-xs text-slate-500">{creditUsage}% of {formatIdr(summary.creditCard.limit)} limit</span>
  </section>
</section>
```

Update existing static assertions that name `Financial health` so they name
`Financial pulse`. Preserve existing one-credit-card count and ordering check by
comparing Financial Pulse before nested Credit Card.

- [ ] **Step 4: Move alert before charts and add mobile recent list**

Render Latest Alert immediately after pulse. Keep its existing semantic status
icon/text. Keep desktop table with `overview-recent-desktop hidden md:block`.
Add mobile list using the same `summary.recentTransactions`:

```tsx
<ul className="overview-recent-mobile divide-y divide-veyra-line md:hidden" aria-label="Recent transactions">
  {summary.recentTransactions.map((transaction) => (
    <li key={transaction.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3">
      <strong className="min-w-0 break-words text-sm">{transaction.merchant ?? "Unknown merchant"}</strong>
      <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === "income" ? "text-veyra-success" : ""}`}>
        {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
      </span>
      <span className="mt-1 text-xs text-slate-500">
        <time dateTime={transaction.date}>{transactionDate.format(new Date(`${transaction.date}T00:00:00Z`))}</time>
        {` · ${transaction.category ?? "Uncategorized"}`}
      </span>
    </li>
  ))}
</ul>
```

Keep trend, category, budgets, desktop recent table, and Veyra insight after the
alert. Keep one column below `xl` and current wide ratios at `xl`.

- [ ] **Step 5: Replace category palette**

Use:

```ts
const colors = ["#00B3FF", "#168BC4", "#2F6F96", "#466579", "#7892A3", "#CBD5E1"];
```

Delete unused `--color-veyra-purple` theme token. Do not remove semantic
warning/success/danger colors elsewhere.

- [ ] **Step 6: Match loading structure**

Replace four KPI skeletons with one `aria-label="Loading financial pulse"`
two-area block. Add alert skeleton before chart skeletons. Keep existing
`aria-busy`, announcement, and reduced-motion classes.

- [ ] **Step 7: Verify**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/dashboard-display.test.mjs tests/finance.test.ts
rtk git diff --check
rtk git diff -- src/components/overview-dashboard.tsx src/components/category-breakdown.tsx src/app/dashboard/loading.tsx src/app/globals.css tests/static.test.mjs
```

Expected: tests PASS; no financial/loader contract changes.

---

### Task 3: Add Responsive Transaction Filters and Records

**Files:**
- Modify: `src/components/transactions-page.tsx:44-369`
- Modify: `src/app/transactions/loading.tsx`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: unchanged `Transaction`, `TransactionFilters`, `transactionHref()`,
  `submitFilters()`, pagination, and `onEdit` callback.
- Produces: `.transactions-desktop-table`, `.transactions-mobile-list`, and
  `.transaction-mobile-filters`.

- [ ] **Step 1: Add failing responsive transaction test**

Append:

```js
test("renders mobile transaction records without table scrolling", async () => {
  const [view, loading] = await Promise.all([
    readSource("src/components/transactions-page.tsx"),
    readSource("src/app/transactions/loading.tsx")
  ]);

  assert.match(view, /transactions-desktop-table hidden md:block/);
  assert.match(view, /transactions-mobile-list divide-y/);
  assert.match(view, /transaction-mobile-filters/);
  assert.match(view, /<summary[^>]*>Filters/);
  assert.match(view, /aria-label="Finalized transaction records"/);
  assert.match(loading, /transactions-mobile-skeleton/);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs
```

Expected: FAIL on missing mobile list/filter markers.

- [ ] **Step 3: Split desktop and mobile filters without changing URL state**

Keep current `FilterControls` and desktop form under `hidden md:grid`. Add mobile
search form and native disclosure. Preserve missing filter values with hidden
inputs so `submitFilters()` does not clear them:

```tsx
function PreservedFilters({ filters, names }: {
  filters: TransactionFilters;
  names: Array<"cycle" | "category" | "type" | "search">;
}) {
  return <>{names.map((name) => filters[name] && (
    <input key={name} type="hidden" name={name} value={filters[name] ?? ""} />
  ))}</>;
}
```

Mobile markup:

```tsx
<div className="transaction-mobile-filters space-y-3 md:hidden">
  <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
    <PreservedFilters filters={filters} names={["cycle", "category", "type"]} />
    <label className="min-w-0 text-sm font-semibold text-slate-700">
      <span>Merchant Search</span>
      <input name="search" type="search" autoComplete="off" defaultValue={filters.search ?? ""} maxLength={200} className={fieldClass} />
    </label>
    <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white">Search</button>
  </form>
  <details className="rounded-lg border border-veyra-line bg-white">
    <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">
      Filters{activeFilters(filters).length ? ` (${activeFilters(filters).length})` : ""}
    </summary>
    <form onSubmit={onSubmit} className="grid gap-3 border-t border-veyra-line p-3">
      <PreservedFilters filters={filters} names={["search"]} />
      <label className="text-sm font-semibold text-slate-700">
        <span>Cycle</span>
        <select name="cycle" defaultValue={filters.cycle ?? ""} className={fieldClass}>
          <option value="">All Cycles</option><option value="current">Current Cycle</option><option value="previous">Previous Cycle</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Category</span>
        <select name="category" defaultValue={filters.category ?? ""} className={fieldClass}>
          <option value="">All Categories</option>
          {categoryOptions(data, filters.category).map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Type</span>
        <select name="type" defaultValue={filters.type ?? ""} className={fieldClass}>
          <option value="">All Types</option><option value="expense">Expense</option><option value="income">Income</option>
        </select>
      </label>
      <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white">Apply Filters</button>
    </form>
  </details>
</div>
```

Extract only enough field markup to avoid rendering Merchant Search inside the
disclosure. Do not add component state; native `details` owns expansion.
Use Title Case for touched headings/actions: `Transactions Couldn’t Be Loaded`,
`No Finalized Transactions Match These Filters`, `No Finalized Transactions
Yet`, `Clear Filters`, and `Apply Filters`. Update matching static assertions.

- [ ] **Step 4: Add mobile record list beside desktop table**

Wrap current table:

```tsx
<div className="transactions-desktop-table hidden overflow-x-auto rounded-veyra border border-veyra-line bg-white md:block">
```

Change only current table wrapper's class to the value above; keep its existing
`table`, caption, headers, `TransactionRow` mapping, and closing `div` unchanged.

Add:

```tsx
<ul className="transactions-mobile-list divide-y divide-veyra-line rounded-veyra border border-veyra-line bg-white md:hidden" aria-label="Finalized transaction records">
  {data.items.map((transaction) => {
    const dateLabel = transactionDate.format(new Date(transaction.transactionDate));
    const merchantLabel = transaction.merchant ?? "Unknown merchant";
    const signedAmount = transaction.type === "income" ? transaction.amount : -transaction.amount;
    return (
      <li key={transaction.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-4">
        <strong className="min-w-0 break-words">{merchantLabel}</strong>
        <strong className={`whitespace-nowrap text-right tabular-nums ${transaction.type === "income" ? "text-veyra-success" : "text-veyra-ink"}`}>
          {transaction.type === "income" ? "+" : ""}{formatIdr(signedAmount)}
        </strong>
        <p className="min-w-0 break-words text-xs text-slate-600">
          <time dateTime={transaction.transactionDate}>{dateLabel}</time>
          {` · ${transaction.category ?? "Uncategorized"} · ${transaction.pocketName ?? "No pocket"}`}
        </p>
        <button type="button" aria-label={`Edit transaction ${merchantLabel} on ${dateLabel}`} onClick={(event) => onEdit(transaction, event.currentTarget)} className="min-h-10 rounded-lg border border-veyra-line px-3 text-sm font-semibold text-sky-700">
          Edit
        </button>
        <span className="sr-only">{transaction.source} {transaction.type}</span>
      </li>
    );
  })}
</ul>
```

Keep one shared pagination after both representations.

- [ ] **Step 5: Match loading state**

Keep current desktop table skeleton under `hidden md:block`. Add a
`transactions-mobile-skeleton divide-y ... md:hidden` list of six record-shaped
skeletons. Keep loading announcement and no fake financial values.

- [ ] **Step 6: Verify filters, pagination, and rendering contracts**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/transaction-filters.test.ts tests/transaction-result-announcement.test.ts
rtk git diff --check
rtk git diff -- src/components/transactions-page.tsx src/app/transactions/loading.tsx tests/static.test.mjs
```

Expected: tests PASS; desktop table semantics and URLs unchanged.

---

### Task 4: Simplify Pockets and Add Mobile Action Disclosures

**Files:**
- Modify: `src/components/pockets-page.tsx:14-145`
- Modify: `src/app/pockets/loading.tsx`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: unchanged `Pocket`, `DefaultPocketButton`, `openDialog()`, and
  `setDefaultPocketAction`.
- Produces: `.pocket-list`, desktop direct actions, and native mobile
  `details` disclosures.

- [ ] **Step 1: Add failing pocket-layout test**

Append:

```js
test("uses divided pockets with compact mobile actions", async () => {
  const [view, loading] = await Promise.all([
    readSource("src/components/pockets-page.tsx"),
    readSource("src/app/pockets/loading.tsx")
  ]);

  assert.match(view, /pocket-list divide-y/);
  assert.match(view, /<details className="pocket-mobile-actions/);
  assert.match(view, /<summary[^>]*>More Actions<\/summary>/);
  assert.match(view, /hidden gap-2 sm:flex/);
  assert.match(loading, /pocket-list-skeleton/);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs
```

Expected: FAIL on missing divided list and disclosure.

- [ ] **Step 3: Replace card stack with one divided list**

Use one outer surface and divider rows:

```tsx
<ul className="pocket-list divide-y divide-veyra-line overflow-hidden rounded-veyra border border-veyra-line bg-white" aria-label="Pockets">
  {pockets.map((pocket) => (
    <li key={pocket.id} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-base font-bold text-veyra-ink">{pocket.name}</h2>
          {pocket.isDefault && <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">Default</span>}
        </div>
        <p className="mt-1 text-lg font-semibold tabular-nums text-veyra-ink">
          {pocket.amount === null ? "No Budget Set" : formatIdr(pocket.amount)}
        </p>
      </div>
    </li>
  ))}
</ul>
```

- [ ] **Step 4: Render direct desktop actions and native mobile disclosure**

Keep existing buttons/forms under `hidden gap-2 sm:flex`. Add:

```tsx
<details className="pocket-mobile-actions rounded-lg border border-veyra-line bg-white sm:hidden">
  <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">More Actions</summary>
  <div className="grid gap-2 border-t border-veyra-line p-2">
    <button type="button" onClick={(event) => onOpen({ mode: "rename", pocket }, event.currentTarget)} className={secondaryButton}>Rename</button>
    <button type="button" onClick={(event) => onOpen({ mode: "budget", pocket }, event.currentTarget)} className={secondaryButton}>Set Budget</button>
    {!pocket.isDefault && <DefaultPocketButton pocketId={pocket.id} onResult={onDefault} />}
  </div>
</details>
```

Make Add Pocket full width below 640px with `w-full sm:w-auto`. Keep return-focus
tracking on the exact action button opening each dialog.

Use Title Case for touched headings/actions: `Add Pocket`, `Set Budget`, `Make
Default`, `Pockets Couldn’t Be Loaded`, and `No Pockets Yet`. Update matching
static assertions.

- [ ] **Step 5: Match loading state**

Replace four independent card skeletons with one
`pocket-list-skeleton divide-y` outer surface. Each row includes name, budget,
and action-shape skeletons; action shape becomes full width on mobile.

- [ ] **Step 6: Verify pocket contracts**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/pocket-contract.test.ts tests/pockets-api.test.ts
rtk git diff --check
rtk git diff -- src/components/pockets-page.tsx src/app/pockets/loading.tsx tests/static.test.mjs
```

Expected: tests PASS; all existing actions remain reachable.

---

### Task 5: Harden Dialog Sheets and Form Interaction

**Files:**
- Modify: `src/components/transaction-edit-dialog.tsx:20-263`
- Modify: `src/components/pocket-dialog.tsx:21-165`
- Modify: `src/app/globals.css:42-142`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: existing native dialogs, `dirty`, `pending`, field refs, and action
  states.
- Produces: safe-area full mobile sheets, contained overscroll, deliberate
  autocomplete, polite pocket errors, and dirty transaction discard guard.

- [ ] **Step 1: Add failing dialog-guideline tests**

Append:

```js
test("keeps mobile sheets safe and prevents silent dirty closes", async () => {
  const [transactionDialog, pocketDialog, css] = await Promise.all([
    readSource("src/components/transaction-edit-dialog.tsx"),
    readSource("src/components/pocket-dialog.tsx"),
    readSource("src/app/globals.css")
  ]);

  assert.match(transactionDialog, /Discard unsaved changes\?/);
  assert.match(transactionDialog, /beforeunload/);
  assert.match(transactionDialog, /autoComplete="off"/);
  assert.match(pocketDialog, /role="status" aria-live="polite"/);
  assert.match(pocketDialog, /autoComplete="off"/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs
```

Expected: FAIL on missing dirty warning, autocomplete, live status, and
overscroll rule.

- [ ] **Step 3: Guard dirty transaction closes**

Replace `closeDialog()` with:

```tsx
function closeDialog(force = false): void {
  if (pending) return;
  if (!force && dirty && !window.confirm("Discard unsaved changes?")) return;
  dialogRef.current?.close();
}
```

Successful save closes with `closeDialog(true)`. `reloadTransaction()` asks
through normal `closeDialog()` unless conflict/not-found state has replaced the
editable flow. Route native cancel through `closeDialog()`:

```tsx
onCancel={(event) => {
  event.preventDefault();
  closeDialog();
}}
```

Change close-button and Cancel handlers to `onClick={() => closeDialog()}` so
React click events are never passed as the `force` argument.

Add browser unload protection while dirty:

```tsx
useEffect(() => {
  if (!dirty) return;
  const warn = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = true;
  };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}, [dirty]);
```

Do not add custom modal state or dependency.

- [ ] **Step 4: Add form metadata and pocket live status**

Add `autoComplete="off"` to amount, merchant, category, pocket, pocket-name,
and pocket-budget controls. Change pocket error block to:

```tsx
<p id={statusId} role="status" aria-live="polite" className="mt-4 rounded-lg border border-veyra-line bg-slate-50 p-3 text-sm text-slate-700">
  {descriptionFor(state)}
</p>
```

Keep existing labels, `name`, input types, `inputMode`, inline errors, and first
error focus.

Use Title Case for touched dialog headings/actions: `Edit Transaction`, `Add
Pocket`, `Rename Pocket`, `Set Monthly Budget`, and `Save Changes`. Update
matching source assertions.

- [ ] **Step 5: Make both dialogs full mobile sheets**

In CSS:

```css
.transaction-edit-dialog,
.pocket-dialog {
  overscroll-behavior: contain;
}

.transaction-edit-dialog > div,
.pocket-dialog > form {
  overscroll-behavior: contain;
}

@media (max-width: 640px) {
  .transaction-edit-dialog,
  .pocket-dialog {
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    border-radius: 0;
  }

  .transaction-edit-dialog > div,
  .pocket-dialog > form {
    overflow-y: auto;
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
  }
}
```

Retain Telegram-specific max-height override using its runtime viewport and safe
area variables. Verify the generic rule does not cover fixed bottom navigation
inside the top-layer dialog.

- [ ] **Step 6: Verify dialog behavior**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/transaction-edit-form.test.ts tests/telegram-mini-app.test.mjs
rtk git diff --check
rtk git diff -- src/components/transaction-edit-dialog.tsx src/components/pocket-dialog.tsx src/app/globals.css tests/static.test.mjs
```

Expected: tests PASS; pending lockout, save, validation, conflict, focus return,
and Telegram rules remain.

---

### Task 6: Final Loading Alignment, Full Verification, and QA Evidence

**Files:**
- Inspect: `src/app/dashboard/loading.tsx`
- Inspect: `src/app/transactions/loading.tsx`
- Inspect: `src/app/pockets/loading.tsx`
- Modify after browser QA: `design-qa.md`
- Modify after acceptance: `BACKLOG.md`

**Interfaces:**
- Consumes: final page structures and all prior task tests.
- Produces: verified responsive states and accurate QA/backlog evidence.

- [ ] **Step 1: Run focused UI suite**

Run:

```bash
rtk node --conditions=react-server --test tests/static.test.mjs tests/dashboard-display.test.mjs tests/finance.test.ts tests/transaction-filters.test.ts tests/transaction-result-announcement.test.ts tests/transaction-edit-form.test.ts tests/pocket-contract.test.ts tests/telegram-mini-app.test.mjs
```

Expected: PASS. If failure is a stale source assertion, update assertion only
when new design spec intentionally supersedes old structure.

- [ ] **Step 2: Run full lightweight verification**

Run:

```bash
rtk npm test
rtk git diff --check
rtk git status --short
```

Expected: full test suite PASS; no whitespace errors. Do not run production
build on VPS.

- [ ] **Step 3: Inspect complete diff**

Run:

```bash
rtk git diff -- BACKLOG.md src/app/globals.css src/app/dashboard/loading.tsx src/app/transactions/loading.tsx src/app/pockets/loading.tsx src/components/app-shell.tsx src/components/overview-dashboard.tsx src/components/category-breakdown.tsx src/components/transactions-page.tsx src/components/pockets-page.tsx src/components/transaction-edit-dialog.tsx src/components/pocket-dialog.tsx tests/static.test.mjs tests/telegram-mini-app.test.mjs design-qa.md
```

Confirm no Core/API/auth action changed, no `NEXT_PUBLIC_` secret appeared, no
purple accent remains in dashboard UI, and no unrelated file changed.

- [ ] **Step 4: Run normal-browser responsive QA**

Use authenticated controllable browser and Core fixtures. Check populated,
empty, complete-error, transaction-error, pocket-error, loading, filter-active,
and dialog states at:

```text
320x568
375x812
390x844
767x1024
768x1024
1024x768
1440x900
```

At 375x812 also test 200% browser text zoom. Record `clientWidth`,
`scrollWidth`, focused-element visibility, console errors, failed requests, and
hydration warnings. Expected: no page-level horizontal overflow; only desktop
tables render at `md` and wider; bottom navigation never covers last content or
dialog actions.

- [ ] **Step 5: Run keyboard and reduced-motion QA**

Keyboard path:

```text
skip link, primary navigation, period selector, chart points, filters,
active-filter removal, transaction Edit, dialog fields, Cancel/Save,
pocket More Actions, pocket dialog, pagination
```

Expected: visible focus, correct focus return, Escape/close discard warning only
when transaction is dirty, first validation error receives focus, live updates
announce, reduced motion disables skeleton/transition motion.

- [ ] **Step 6: Run Telegram acceptance**

Check Android, iOS, and Desktop Telegram:

- cold and repeat launch
- light and dark Telegram chrome coordination
- Overview/Transactions/Pockets bottom navigation
- BackButton routes to Overview
- safe-area top/bottom and stable viewport
- transaction and pocket sheets above software keyboard
- sign-out remains reachable through supported Telegram flow

Expected: existing authentication/runtime behavior unchanged; new layout fits
safe areas.

- [ ] **Step 7: Update evidence only with observed results**

Add a dated section to `design-qa.md` listing actual captures, viewports, states,
overflow measurements, keyboard checks, console/network diagnostics, and any
remaining P3 notes. Never claim unrun build or unavailable device result.

When every B-006 acceptance item passes, remove B-006 from Current Work and add
one short Completed This Week row. Update B-005 only if its remaining real-
browser transaction QA also passed in the same controlled run.

- [ ] **Step 8: Final completion check**

Run:

```bash
rtk rg -n "T[B]D|T[O]DO|implement lat[e]r|fill i[n]" docs/superpowers/plans/2026-08-23-veyra-responsive-dashboard.md docs/superpowers/specs/2026-08-23-veyra-responsive-dashboard-design.md
rtk git diff --check
rtk git status --short
```

Expected: no unresolved plan markers, no whitespace errors, only intended files
modified.
