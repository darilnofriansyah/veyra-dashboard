# Veyra Transactions Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected, filterable Transactions page that lists finalized records and edits amount, category, or merchant through the new Core API.

**Architecture:** Next.js server components verify the Veyra session and load strict Core response contracts; URL parameters own visible filters and cursor state. A client table opens a native modal side panel, while a separately authenticated server action validates edits and calls Core. Shared shell extraction gives Overview and Transactions one sidebar without moving financial calculations into the browser.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5.9, Tailwind CSS 4, Node 24 test runner, Phosphor icons

## Global Constraints

- Show only Core-confirmed `income` and `expense` transactions.
- Do not add transaction creation, deletion, confirmation, or ingestion review.
- Visible filters are `cycle`, `category`, `type`, and merchant `search`; their source of truth is the URL.
- Cursor pagination is opaque and retains filters; changing a filter removes cursor state.
- Editable fields are amount, merchant, and category only.
- Amount is a positive safe whole-rupiah integer; expense merchant/category are required; income values may be empty.
- Every page load and server action derives `telegramUserId` from the verified session; browser input never controls identity.
- `CORE_API_KEY` and `NEXUS_CORE_URL` remain server-only.
- No new runtime or test dependency.
- Core API from `docs/superpowers/plans/2026-08-13-web-transactions-api.md` must deploy before this page.
- Preserve unrelated `PROJECT_REVIEW.md` worktree changes.

---

## File structure

### New files

- `src/lib/transaction-contract.ts` — transaction types plus strict Core response and edit-form parsing.
- `src/lib/transaction-filters.ts` — URL filter normalization and canonical URL generation.
- `src/lib/transactions-api.ts` — server-only Core query and update calls.
- `src/components/app-shell.tsx` — shared authenticated sidebar, account block, skip link, and page frame.
- `src/components/transactions-page.tsx` — visible filters, active chips, table, pagination, empty/error states, and edit selection.
- `src/components/transaction-edit-dialog.tsx` — native dialog side panel and server-action state.
- `src/app/transactions/page.tsx` — authenticated server route.
- `src/app/transactions/actions.ts` — independently authenticated edit action.
- `src/app/transactions/loading.tsx` — stable transactions skeleton.
- `tests/transaction-contract.test.ts` — response and form contract behavior.
- `tests/transaction-filters.test.ts` — URL normalization and canonical link behavior.
- `tests/transactions-api.test.ts` — Core request, response, and error mapping behavior.

### Modified files

- `src/components/overview-dashboard.tsx` — render current dashboard content inside shared shell.
- `src/proxy.ts` — protect `/transactions`.
- `src/app/globals.css` — input and native dialog/backdrop primitives.
- `tests/session-proxy.test.mjs` — transactions route auth coverage.
- `tests/static.test.mjs` — shell, route, filter, table, dialog, and no-create structural coverage.
- `README.md` — document query/edit Core boundary and correction behavior.
- `BACKLOG.md` — record transaction-page work and completion evidence.

---

### Task 1: Transaction contracts and URL state

**Files:**

- Create: `src/lib/transaction-contract.ts`
- Create: `src/lib/transaction-filters.ts`
- Test: `tests/transaction-contract.test.ts`
- Test: `tests/transaction-filters.test.ts`

**Interfaces:**

- Produces: `Transaction`, `TransactionPageData`, `TransactionEditInput`, `TransactionEditState`, `parseTransaction(value)`, `parseTransactionPageData(value)`, and `parseTransactionEditForm(formData)`.
- Produces: `RawTransactionSearchParams`, `TransactionFilters`, `parseTransactionFilters(raw)`, `transactionHref(filters, changes)`.
- `TransactionFilters` is `{ cycle: "current" | "previous" | null; category: string | null; type: "income" | "expense" | null; search: string | null; cursor: string | null; direction: "next" | "previous" | null }`.

- [ ] **Step 1: Write failing contract tests**

Create fixtures covering a valid expense, a nullable-metadata income, and this edit parser behavior:

```ts
test("parses an expense edit into a positive whole-rupiah input", () => {
  const form = new FormData();
  form.set("transactionId", "123");
  form.set("expectedUpdatedAt", "2026-08-13T03:01:00.000Z");
  form.set("type", "expense");
  form.set("amount", "30000");
  form.set("merchant", " Tuku Kemang ");
  form.set("category", " Dining ");

  assert.deepEqual(parseTransactionEditForm(form), {
    ok: true,
    value: {
      transactionId: "123",
      expectedUpdatedAt: "2026-08-13T03:01:00.000Z",
      amount: 30000,
      merchant: "Tuku Kemang",
      category: "Dining"
    }
  });
});
```

Add named tests proving fractional/zero/unsafe amounts fail, expense blank text fails, income blank text becomes `null`, malformed timestamps fail, response enums are strict, cursors are nullable text, and malformed response data throws.

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `node --test tests/transaction-contract.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/transaction-contract.ts`.

- [ ] **Step 3: Implement contract types and parsers**

Use discriminated results rather than exceptions for user form input:

```ts
export type TransactionEditState =
  | { status: "idle" }
  | { status: "validation"; fieldErrors: Partial<Record<"amount" | "merchant" | "category", string>> }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "success"; transaction: Transaction };

export type ParsedTransactionEdit =
  | { ok: true; value: TransactionEditInput & { transactionId: string } }
  | { ok: false; state: Extract<TransactionEditState, { status: "validation" }> };
```

Strictly accept positive numeric-string IDs, safe whole-rupiah amounts, UTC ISO
timestamps with fractional seconds, sources `telegram|email|manual|import`,
types `income|expense`, and boolean `creditCard`. Preserve timestamp strings
exactly rather than normalizing through `Date`, because `updatedAt` is the
optimistic version. Bound merchant/category/search to 200 characters and cursors
to 512 characters. Reject duplicate categories and malformed/non-object payloads.

- [ ] **Step 4: Run contract tests and confirm GREEN**

Run: `node --test tests/transaction-contract.test.ts`

Expected: all contract tests PASS.

- [ ] **Step 5: Write failing filter tests**

```ts
test("normalizes supported filters and drops arrays or unknown values", () => {
  assert.deepEqual(parseTransactionFilters({
    cycle: "current",
    category: " Dining ",
    type: "expense",
    search: " tuku ",
    cursor: "cursor-1",
    direction: "next",
    ignored: "value"
  }), {
    cycle: "current",
    category: "Dining",
    type: "expense",
    search: "tuku",
    cursor: "cursor-1",
    direction: "next"
  });
});

test("changing a filter clears cursor state", () => {
  const href = transactionHref(filtersWithCursor, { category: "Groceries" });
  assert.equal(href, "/transactions?cycle=current&category=Groceries&type=expense");
});
```

Also prove removing one chip preserves other filters, invalid direction without a
cursor is removed, category/search over 200 characters or cursor over 512
characters are removed, and URL encoding is canonical.

- [ ] **Step 6: Run filter tests and confirm RED**

Run: `node --test tests/transaction-filters.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/transaction-filters.ts`.

- [ ] **Step 7: Implement filter parsing and canonical links**

`transactionHref` must start from normalized filters, apply changes, clear
`cursor` and `direction` whenever `cycle`, `category`, `type`, or `search`
changes, then append parameters in that exact order.

- [ ] **Step 8: Run focused tests and commit**

Run: `node --test tests/transaction-contract.test.ts tests/transaction-filters.test.ts`

Expected: all tests PASS.

```bash
git add src/lib/transaction-contract.ts src/lib/transaction-filters.ts tests/transaction-contract.test.ts tests/transaction-filters.test.ts
git commit -m "feat: define transaction page contracts"
```

---

### Task 2: Server-only Core transactions client

**Files:**

- Create: `src/lib/transactions-api.ts`
- Test: `tests/transactions-api.test.ts`

**Interfaces:**

- Consumes: `TransactionFilters`, `TransactionEditInput`, `TransactionPageData`, `Transaction`, and `parseTransactionPageData` from Task 1.
- Produces: `loadTransactions(input, fetchImpl?)` returning `{ data: TransactionPageData | null; error: boolean }`.
- Produces: `updateTransaction(telegramUserId, transactionId, input, fetchImpl?)` returning `Exclude<TransactionEditState, { status: "idle" }>`.

- [ ] **Step 1: Write failing query request test**

```ts
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
  assert.equal(String(calls[0]?.input), "http://core-api:3000/api/veyra/transactions/query");
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
```

Add tests for API key inclusion, trailing-slash removal, invalid identity/date
without fetch, omission of null filters, five-second signal, non-2xx, network
failure, malformed JSON, and strict response drift.

- [ ] **Step 2: Run focused query tests and confirm RED**

Run: `node --test tests/transactions-api.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/transactions-api.ts`.

- [ ] **Step 3: Implement the query call**

Use the established Core boundary:

```ts
const response = await fetchImpl(`${baseUrl}/api/veyra/transactions/query`, {
  method: "POST",
  cache: "no-store",
  signal: AbortSignal.timeout(5_000),
  headers: {
    "content-type": "application/json",
    ...(apiKey ? { "x-core-api-key": apiKey } : {})
  },
  body: JSON.stringify(body)
});
```

Return one safe error result for network, contract, JSON, identity, and non-2xx
failures. Never include upstream response text in returned errors.

- [ ] **Step 4: Run query tests and confirm GREEN**

Run: `node --test tests/transactions-api.test.ts --test-name-pattern="query|loads|maps|rejects"`

Expected: selected tests PASS.

- [ ] **Step 5: Write failing update mapping tests**

Prove PATCH path/body, API key, timeout, strict success parsing, and exact status
mapping: `400 -> validation`, `404 -> not_found`, `409 -> conflict`, other status
or network failure -> `unavailable`.

```ts
assert.deepEqual(JSON.parse(String(call.init?.body)), {
  telegramUserId: "976684739",
  amount: 30000,
  merchant: "Tuku Kemang",
  category: "Dining",
  expectedUpdatedAt: "2026-08-13T03:01:00.000Z"
});
```

- [ ] **Step 6: Implement update call and verify**

Encode transaction ID with `encodeURIComponent`, require numeric ID before
fetch, parse `200` through the same strict transaction parser, and never forward
Core error bodies.

Run: `node --test tests/transactions-api.test.ts`

Expected: all API tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/transactions-api.ts tests/transactions-api.test.ts
git commit -m "feat: add Core transactions client"
```

---

### Task 3: Shared authenticated shell and route protection

**Files:**

- Create: `src/components/app-shell.tsx`
- Modify: `src/components/overview-dashboard.tsx`
- Modify: `src/proxy.ts`
- Modify: `tests/session-proxy.test.mjs`
- Modify: `tests/static.test.mjs`

**Interfaces:**

- Produces: `AppShell({ activePage, viewerName, accountContext, mainId, skipLabel, children })`.
- `activePage` is `"overview" | "transactions"`; `children` is `ReactNode`.

- [ ] **Step 1: Write failing shell and proxy tests**

Extend static tests to require one shared shell import, real `/dashboard` and
`/transactions` links, both labels, and route-derived `aria-current`. Extend
proxy tests:

```js
test("redirects signed-out transaction requests to login", async () => {
  const response = await proxy(request("/transactions"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
});
```

Change matcher expectation to `['/', '/dashboard', '/transactions']`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/session-proxy.test.mjs tests/static.test.mjs`

Expected: FAIL because shell and route protection do not exist.

- [ ] **Step 3: Extract shell and refactor Overview**

Move logo, sidebar, account initials, logout form, skip link, outer grid, and
`<main>` into `AppShell`. Use `next/link` for both destinations. Keep current
Overview content, period state, copy, IDs, and financial rendering unchanged.

```tsx
<AppShell
  activePage="overview"
  viewerName={viewerName}
  accountContext={cycleLabel}
  mainId="overview"
  skipLabel="Skip to overview"
>
  {overviewContent}
</AppShell>
```

- [ ] **Step 4: Protect transactions route**

Use `path === "/dashboard" || path === "/transactions"` for signed-out
redirection and set matcher to all three authenticated-entry paths.

- [ ] **Step 5: Verify shell extraction did not change Overview behavior**

Run: `node --test tests/session-proxy.test.mjs tests/static.test.mjs tests/dashboard-display.test.mjs`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell.tsx src/components/overview-dashboard.tsx src/proxy.ts tests/session-proxy.test.mjs tests/static.test.mjs
git commit -m "refactor: share authenticated app shell"
```

---

### Task 4: Protected list route, visible filters, table, and pagination

**Files:**

- Create: `src/app/transactions/page.tsx`
- Create: `src/components/transactions-page.tsx`
- Modify: `tests/static.test.mjs`

**Interfaces:**

- Consumes: `parseTransactionFilters`, `transactionHref`, `loadTransactions`,
  `TransactionPageData`, and `AppShell`.
- Produces: `TransactionsPage({ result, filters, viewerName })`.

- [ ] **Step 1: Write failing route and interface tests**

Static tests must require async `searchParams`, session verification, Jakarta
date, `loadTransactions`, all visible filter labels, active chips, table caption
and headers, Retry, Clear filters, Previous/Next links, and absence of Create.

```js
assert.match(page, /searchParams:\s*Promise</);
assert.match(page, /await searchParams/);
assert.match(view, />Cycle</);
assert.match(view, />Category</);
assert.match(view, />Type</);
assert.match(view, />Merchant search</);
assert.doesNotMatch(view, /Create transaction|New transaction/);
```

- [ ] **Step 2: Run static tests and confirm RED**

Run: `node --test tests/static.test.mjs`

Expected: FAIL because transaction route and view are missing.

- [ ] **Step 3: Implement authenticated server route**

Use the Next.js 16 promise form for page search parameters:

```tsx
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  const filters = parseTransactionFilters(await searchParams);
  const result = await loadTransactions({
    telegramUserId: session.telegramUserId,
    asOfDate: jakartaToday(),
    filters
  });
  return <TransactionsPage result={result} filters={filters} viewerName={session.name} />;
}
```

Add metadata title `Transactions` and description `Review and correct your Veyra transactions`.

- [ ] **Step 4: Implement filter and table states**

Render a form whose named controls match URL parameters. On submit, prevent the
default request, read values from `FormData`, and call
`router.push(transactionHref(filters, changes))`. This omits empty values and
resets pagination without keeping private committed-filter state. Render
removable chips with `transactionHref`. Render signed IDR amounts using existing
`formatIdr`. Task 4 is a complete read-only list; Task 6 adds the Action column
and working Edit controls together with their dialog.
Use `<time dateTime>`, table caption, scoped headers, and accessible Edit names.

Pass `accountContext="Finalized records"` to `AppShell`. Header count states how
many rows are loaded on the current page, never an unprovided all-time total.
Unavailable state keeps filter bar and calls `router.refresh()` from Retry.
Unfiltered empty copy points users to Telegram/email ingestion; filtered empty
copy offers Clear filters. Pagination links exist only for returned cursors.

- [ ] **Step 5: Run list tests and full test suite**

Run: `node --test tests/static.test.mjs tests/transaction-filters.test.ts tests/transactions-api.test.ts`

Expected: selected tests PASS.

Run: `npm test`

Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/transactions/page.tsx src/components/transactions-page.tsx tests/static.test.mjs
git commit -m "feat: add filterable transaction list"
```

---

### Task 5: Independently authenticated edit server action

**Files:**

- Create: `src/app/transactions/actions.ts`
- Modify: `tests/transactions-api.test.ts`
- Modify: `tests/static.test.mjs`

**Interfaces:**

- Consumes: `parseTransactionEditForm`, `updateTransaction`, session cookie helpers.
- Produces: `editTransaction(previousState: TransactionEditState, formData: FormData): Promise<TransactionEditState>`.

- [ ] **Step 1: Write failing action boundary tests**

Add source assertions requiring `"use server"`, session cookie verification,
`parseTransactionEditForm`, `updateTransaction(session.telegramUserId, ...)`,
and `revalidatePath("/transactions")` plus `revalidatePath("/dashboard")` only
after success. Assert action does not read `telegramUserId` from `FormData`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/static.test.mjs tests/transaction-contract.test.ts tests/transactions-api.test.ts`

Expected: FAIL because edit action is missing.

- [ ] **Step 3: Implement action**

```ts
export async function editTransaction(
  _previousState: TransactionEditState,
  formData: FormData
): Promise<TransactionEditState> {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return { status: "unavailable" };
  const parsed = parseTransactionEditForm(formData);
  if (!parsed.ok) return parsed.state;
  const { transactionId, ...input } = parsed.value;
  const result = await updateTransaction(session.telegramUserId, transactionId, input);
  if (result.status === "success") {
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
  }
  return result;
}
```

Authentication failure stays generic and does not redirect from action state.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/static.test.mjs tests/transaction-contract.test.ts tests/transactions-api.test.ts`

Expected: all selected tests PASS.

```bash
git add src/app/transactions/actions.ts tests/static.test.mjs tests/transactions-api.test.ts
git commit -m "feat: add transaction edit action"
```

---

### Task 6: Accessible edit side panel and credit-used note

**Files:**

- Create: `src/components/transaction-edit-dialog.tsx`
- Modify: `src/components/transactions-page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/static.test.mjs`

**Interfaces:**

- Consumes: `Transaction`, `TransactionEditState`, `editTransaction`.
- Produces: `TransactionEditDialog({ transaction, onClose })`.

- [ ] **Step 1: Write failing dialog tests**

Require native `<dialog>`, `showModal`, `useActionState(editTransaction, ...)`,
hidden immutable identifiers, labelled amount/merchant/category controls,
read-only date/type/source, error associations, pending disabled save, Escape or
native close focus return, and this exact eligible-card copy stem:

```text
Credit used will adjust by
```

Require `motion-reduce:transition-none`, `dialog::backdrop`, and no editable
date/type/source fields.

- [ ] **Step 2: Run static tests and confirm RED**

Run: `node --test tests/static.test.mjs`

Expected: FAIL because dialog does not exist.

- [ ] **Step 3: Implement native modal side panel**

Mount dialog only while a row is selected and key it by transaction ID so each
open receives fresh action state. Call `showModal()` in an effect, handle native
`close`/`cancel`, and return focus to the row Edit button through the parent.
Add the Action column in this task. Give each Edit button transaction context in
its accessible name and apply the cyan selection rail to both selected row and
open panel.

```tsx
const [state, action, pending] = useActionState(editTransaction, { status: "idle" });
const amountDelta = Number(amount) - transaction.amount;
const showCreditDelta = transaction.creditCard && Number.isSafeInteger(amountDelta) && amountDelta !== 0;
```

Render hidden `transactionId`, `expectedUpdatedAt`, and `type`; never render
identity. On `success`, close and call `router.refresh()`. On conflict, keep all
fields and show Reload transaction. On not found, close after acknowledgement
and refresh. Validation focuses first invalid input. Generic failure preserves
input and exposes Save changes again.

- [ ] **Step 4: Add restrained side-panel CSS**

Use existing Veyra tokens. Position dialog on the right at desktop, full-width
at narrow viewports, add cyan left rail, and remove transition under
`prefers-reduced-motion`. Do not introduce a new palette or font.

- [ ] **Step 5: Run tests and production build**

Run: `npm test`

Expected: full suite PASS.

Run: `npm run build`

Expected: Next.js production build exits 0 with `/transactions` compiled.

- [ ] **Step 6: Commit**

```bash
git add src/components/transaction-edit-dialog.tsx src/components/transactions-page.tsx src/app/globals.css tests/static.test.mjs
git commit -m "feat: edit transactions in side panel"
```

---

### Task 7: Loading state, documentation, and backlog evidence

**Files:**

- Create: `src/app/transactions/loading.tsx`
- Modify: `README.md`
- Modify: `BACKLOG.md`
- Modify: `tests/static.test.mjs`

**Interfaces:**

- Consumes: final route copy and Core endpoints.
- Produces: stable loading UI and accurate repository documentation.

- [ ] **Step 1: Write failing loading and documentation tests**

Require loading copy `Loading transactions…`, a stable filter/table skeleton,
README references to both Core endpoints, server-only identity, editable fields,
conflict behavior, and credit-card `credit_used` delta. Require README no longer
calls Veyra fully read-only.

- [ ] **Step 2: Run static tests and confirm RED**

Run: `node --test tests/static.test.mjs`

Expected: FAIL on missing loading file and stale README boundary.

- [ ] **Step 3: Implement loading state and documentation**

Keep shell dimensions stable, announce loading with `aria-label`, and render
header/filter/table row skeletons without fake financial values. Update README
Core boundary, ownership, troubleshooting, and deployment order. Add one active
backlog item before final verification, then close it with exact test/build
evidence after Task 8.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/static.test.mjs`

Expected: static tests PASS.

```bash
git add src/app/transactions/loading.tsx README.md BACKLOG.md tests/static.test.mjs
git commit -m "docs: describe transaction corrections"
```

---

### Task 8: Cross-repository integration and final verification

**Files:**

- Modify if evidence changes: `BACKLOG.md`
- Review: all files changed by Tasks 1–7
- Verify dependency: `/home/unmeii/apps/core-api/docs/superpowers/plans/2026-08-13-web-transactions-api.md`

**Interfaces:**

- Consumes: deployed-compatible Core query/PATCH contract and complete Veyra page.
- Produces: verified feature evidence with no contract drift.

- [ ] **Step 1: Compare Core and Veyra contracts field by field**

Check route paths, request names, response names, nullable fields, cursor
direction, cycle/as-of semantics, status mappings, timestamp format, category
options, and `creditCard`. Fix mismatches test-first in the owning repository.

- [ ] **Step 2: Run complete Veyra verification**

Run: `npm test`

Expected: zero failures.

Run: `npm run build`

Expected: exit 0 and `/transactions` appears in build route output.

- [ ] **Step 3: Run complete Core verification through Core subagent**

Use Core plan's exact full test and build commands. Require zero failures and
fresh output; do not rely on agent summary alone. Inspect Core diff and contract
tests from Veyra workspace after report returns.

- [ ] **Step 4: Perform interaction QA**

At desktop and mobile widths verify visible filters, URL persistence,
back/forward behavior, cursor links, horizontal table scrolling, keyboard-only
dialog open/save/cancel, Escape close, focus return, validation focus, conflict
message, empty states, reduced motion, and card delta note.

- [ ] **Step 5: Record exact evidence and commit only if needed**

If Task 7 left an active backlog item, replace it with completion date, commands,
and result counts. Do not modify unrelated backlog or project-review entries.

```bash
git add BACKLOG.md
git commit -m "docs: close transaction page work"
```

- [ ] **Step 6: Review final repository state**

Run: `git status --short`

Expected: only pre-existing unrelated changes remain; no generated build output,
temporary files, or uncommitted feature files.
