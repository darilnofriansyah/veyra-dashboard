# Veyra Transactions Page Design

**Date:** 2026-08-13  
**Status:** Approved for implementation planning  
**Repositories:** `veyra` and `core-api`  
**Release:** Transactions v1

## 1. Purpose

Add an authenticated Transactions page where users can inspect finalized
financial activity and correct an older transaction's amount, category, or
merchant. Transaction creation remains owned by Telegram and email ingestion.

The page must also become the stable destination for future Overview
drilldowns. Visible filters therefore use URL parameters rather than private
component state.

### Success criteria

- Users can find finalized income and expense transactions by cycle, category,
  type, and merchant text.
- Users can edit amount, category, or merchant without losing table filters or
  pagination context.
- Every query and edit is scoped to the signed-in Telegram user.
- Concurrent edits cannot silently overwrite newer data.
- Eligible credit-card amount corrections update cycle credit usage atomically.
- Overview can later deep-link into the page through its public URL contract.

## 2. Approved decisions

| Decision | Direction |
|---|---|
| Records | Finalized `income` and `expense` transactions only |
| Creation | Excluded; Telegram and email ingestion remain owners |
| Filters | Visible cycle, category, type, and merchant search controls |
| Filter state | URL-backed and shareable |
| Pagination | Opaque keyset cursor, 50 rows per page |
| Edit surface | Right side panel opened from a table row |
| Editable fields | Amount, category, merchant |
| Immutable fields | Date, type, source, status, raw ingestion data |
| Data loading | Veyra server-rendered request to Core |
| Mutation | Veyra server action to Core PATCH endpoint |
| Concurrency | Optimistic check with `expectedUpdatedAt` |
| Credit-card correction | Atomic signed delta to cycle `credit_used` |
| Credit limit and statement | Never changed by transaction editing |

## 3. Scope

### Included

- Protected `/transactions` route and loading state
- Shared authenticated application shell
- Transactions sidebar destination and active state
- Visible filter bar with active-filter chips and Clear filters action
- Finalized transaction table
- Previous and Next cursor navigation
- Side-panel editing for amount, category, and merchant
- Inline validation, conflict, not-found, unavailable, and empty states
- Core query and update contracts
- User-scoped Core persistence
- Atomic credit-card usage correction for eligible transactions
- Responsive, keyboard, screen-reader, and reduced-motion behavior
- Tests and boundary documentation in both repositories

### Excluded

- Creating, deleting, rejecting, or confirming transactions
- Editing date, transaction type, source, status, notes, or raw payload
- Pending ingestion review
- Arbitrary date-range filtering
- Sorting controls beyond newest-first order
- Bulk edit, export, saved views, or row selection
- New category or merchant entity tables
- Full transaction detail route
- Per-card credit-card modeling
- Recalculation of credit limit or statement balance

## 4. Experience and visual design

The page extends Veyra's existing cool white, slate, navy, and cyan system. It
uses dense financial data, tabular numerals, modest rounding, strong focus
states, and restrained motion. No new decorative visual language is introduced.

The signature interaction is a cyan selection rail. The selected table row and
open edit panel share the rail, making their relationship clear while the table
and current filters remain visible.

### Application shell

- Extract the existing Overview shell so both authenticated pages share logo,
  sidebar navigation, account identity, cycle context, sign out, and responsive
  behavior.
- Sidebar destinations are `Overview` and `Transactions`.
- Active destination uses `aria-current="page"` and the existing cyan treatment.
- `/transactions` receives the same session verification as `/dashboard`; proxy
  protection covers both routes.

### Page header

- Title: `Transactions`
- Supporting copy explains that finalized records are shown.
- Count copy reflects the loaded page, not an unprovided all-time total.
- No Create transaction button is rendered.

### Visible filter bar

Controls appear directly above the table:

1. Cycle: `All cycles`, `Current cycle`, `Previous cycle`
2. Category: `All categories` plus available category values
3. Type: `All types`, `Expense`, `Income`
4. Merchant search field
5. Clear filters action

Applied filters also appear as removable chips. Submitting a filter replaces the
URL parameters and clears the cursor. Filter values survive refresh, back/forward
navigation, copying, and future Overview drilldowns.

### Transaction table

Desktop columns:

- Date
- Merchant
- Category
- Source
- Type
- Amount
- Action

Rows are ordered by transaction timestamp descending, then ID descending. Income
amounts use a positive sign and expenses use a negative sign. Null income
merchant/category values display neutral fallbacks. Source and type use text in
addition to any color treatment.

Mobile keeps a semantic table in a horizontal scroll container, matching the
existing Overview pattern. Edit controls retain accessible names containing row
context.

### Edit side panel

Selecting Edit opens a right-side panel without navigating away. It contains:

- Editable amount input in whole IDR
- Editable merchant input
- Editable category input
- Read-only date, type, and source context
- Cancel and Save changes actions

Expense merchant and category are required. Income merchant and category may be
empty. Save disables while pending. Successful save closes the panel and
refreshes the same filtered URL. Validation stays beside the relevant field.

For an eligible email credit-card transaction whose amount changed, the panel
shows `Credit used will adjust by IDR …` before save. Merchant and category edits
never affect credit usage.

### Pagination and future detail

Previous and Next controls preserve all active filters. Cursor values are
opaque. V1 does not expose a standalone row detail route, but transaction IDs
remain stable so Overview rows and a later detail route can reuse the same data
boundary.

## 5. URL contract

Canonical page:

```text
/transactions
```

Supported parameters:

```text
cycle=current|previous
category=<exact category>
type=income|expense
search=<merchant text>
cursor=<opaque Core cursor>
direction=next|previous
```

Unknown values are discarded rather than forwarded. Empty values are omitted.
Search is trimmed and length-limited. Veyra sends a validated cycle value plus
the Jakarta calendar date; Core resolves financial-cycle boundaries from the
active user's `cycle_start_day`.

Example future drilldown:

```text
/transactions?cycle=current&category=Dining&type=expense
```

## 6. Veyra architecture

### Route and shell

`src/app/transactions/page.tsx` verifies the session, validates URL state,
calculates the Jakarta calendar date, calls the transaction loader, and renders
the page. It never accepts a Telegram identity from browser input.

The dashboard and transactions pages use a shared authenticated shell component.
Page-specific content and active-route metadata are passed into the shell.

### Server data loader

The loader calls Core from the server with:

- The Telegram ID from the verified Veyra session
- Validated filters and cursor
- The Jakarta calendar date for cycle resolution
- Fixed `Asia/Jakarta` timezone
- Optional server-only Core API key
- `cache: "no-store"`
- Five-second timeout

It validates every Core response field before rendering. Malformed data,
timeouts, and upstream failures become a safe unavailable result without
exposing upstream content.

### Server action

The edit form posts to a Veyra server action. The action verifies the session
again, validates submitted fields, and sends a PATCH request to Core. It returns
one typed result:

- success with updated transaction
- field validation errors
- stale conflict
- not found
- generic unavailable

On success it revalidates transaction and dashboard data because amount,
merchant, or category changes can affect Overview totals and breakdowns.

## 7. Core API contract

Core remains the persistence owner. The browser never calls it directly and
never receives `CORE_API_KEY`.

### Query

```http
POST /api/veyra/transactions/query
```

Request:

```json
{
  "telegramUserId": "976684739",
  "cursor": "opaque-value",
  "direction": "next",
  "limit": 50,
  "cycle": "current",
  "asOfDate": "2026-08-13",
  "type": "expense",
  "category": "Dining",
  "merchantQuery": "tuku",
  "timezone": "Asia/Jakarta"
}
```

Status is not client-selectable in v1. Core always restricts this endpoint to
`status = 'confirmed'` and `transaction_type IN ('income', 'expense')`.

Response:

```json
{
  "items": [
    {
      "id": "123",
      "amount": 25000,
      "merchant": "TUKU",
      "category": "Dining",
      "type": "expense",
      "source": "email",
      "transactionDate": "2026-08-13T03:00:00.000Z",
      "updatedAt": "2026-08-13T03:01:00.000Z",
      "creditCard": true
    }
  ],
  "previousCursor": null,
  "nextCursor": "opaque-value",
  "categories": ["Dining", "Groceries"]
}
```

The repository resolves the active Telegram user first, then scopes every query
by internal `user_id`. For `current` or `previous`, Core derives start and
exclusive-end timestamps from `asOfDate`, timezone, and that user's
`cycle_start_day`, matching Overview semantics. The keyset uses
`(transaction_date, id)`. Cursor content is encoded and validated by Core;
Veyra treats it as opaque.

Category options come from the finalized user-scoped transaction set under the
current cycle/type/search filters, excluding the category filter itself. No
category entity or speculative management API is added.

### Update

```http
PATCH /api/veyra/transactions/:id
```

Request:

```json
{
  "telegramUserId": "976684739",
  "amount": 30000,
  "merchant": "Tuku Kemang",
  "category": "Dining",
  "expectedUpdatedAt": "2026-08-13T03:01:00.000Z"
}
```

Core accepts only the three editable fields and requires at least one changed
value. Amount must be a positive safe whole-rupiah integer. Text is trimmed and
bounded. Expense merchant/category are non-empty; income values may be null.

Responses:

- `200`: updated transaction
- `400`: invalid request or no changed values
- `404`: unknown, inactive user, missing transaction, or foreign transaction
- `409`: `expectedUpdatedAt` no longer matches
- `5xx`: generic upstream failure

Missing and foreign records share the same `404` response. Raw payload and
ownership data are never returned.

## 8. Atomic credit-card correction

Core currently identifies credit-card activity only for confirmed email
transactions whose immutable `raw_payload.parsed.paymentType` normalizes to
`Credit Card`. The summary is combined per user and financial cycle; there is no
per-card or direct transaction foreign key.

When an eligible transaction's amount changes, Core performs these operations
in one database transaction:

1. Lock the owned transaction row.
2. Check `expectedUpdatedAt`.
3. Calculate signed usage delta.
4. Update transaction fields and `updated_at`.
5. Apply delta to the matching cycle's `credit_used` using the existing timezone
   and cycle-start-day calculation.
6. Commit both changes together.

Delta rules:

- Expense: `new amount - old amount`
- Reversal: `old amount - new amount`

V1 only lists income and expense, but the shared helper keeps the established
reversal rule intact. `credit_used` never falls below zero. `credit_limit` and
`statement_balance` remain unchanged: the former is an account constraint and
the latter is a closed bank statement value.

Transactions without the immutable credit-card marker do not alter the summary.
V1 does not infer card usage from merchant, category, or source alone.

## 9. States and error handling

### Loading

Shell, header, filter bar, table rows, and pagination use stable skeletons.

### Empty

- No finalized records: explain that transactions arrive through Telegram or
  email ingestion.
- No filter matches: state that no results match and offer Clear filters.

### Query unavailable

Keep shell and filters visible, show a safe unavailable message, and offer Retry.

### Edit validation

Keep panel open and place messages beside amount, merchant, or category. Focus
moves to the first invalid field.

### Conflict

Keep panel open, explain that the transaction changed elsewhere, and offer
Reload transaction. Never overwrite silently.

### Not found

Close stale selection after acknowledgement and refresh the list. Do not reveal
whether the record existed for another user.

### Generic save failure

Keep user input in the panel and offer Save changes again.

## 10. Accessibility and responsive behavior

- Table uses caption, column scopes, and real buttons.
- Filter controls have persistent labels; chips have explicit remove names.
- Side panel uses dialog semantics, labelled title, focus containment, Escape
  close, focus return, and background inertness.
- Status, type, source, and amount meaning are never color-only.
- Keyboard focus remains visible under existing Veyra focus styling.
- Reduced-motion preference removes panel transition.
- Horizontal table scrolling never traps vertical page scrolling.
- Live regions announce filter result changes and save outcomes concisely.

## 11. Testing

### Core

- Active Telegram user resolution and inactive/unknown handling
- Strict user isolation for query and update
- Finalized income/expense default scope
- Cycle, category, type, and merchant filters
- Stable forward/backward cursor ordering with duplicate timestamps
- Cursor and input validation
- Expense/income edit rules and no-op rejection
- Foreign and missing transaction indistinguishability
- Optimistic stale-update conflict
- Atomic transaction update and credit-usage delta for amount increase/decrease
- Credit-card rollback when either write fails
- Non-card, merchant-only, and category-only edits leave card summary unchanged
- Existing API-key boundary remains intact

### Veyra

- `/transactions` route and proxy protection
- Sidebar links and active state on both pages
- URL parsing, filter clearing, and cursor reset behavior
- Core request identity, filters, timeout, and API-key handling
- Strict response parsing and safe unavailable mapping
- Populated, empty, filtered-empty, and unavailable table states
- Side-panel accessibility and immutable context
- Field validation, save pending state, success refresh, not found, conflict, and
  generic failure
- Credit-card delta note
- No Create transaction control

### Verification

Run full test suites and production builds in both repositories. Review desktop
and mobile layouts, keyboard navigation, panel focus behavior, filtered deep
links, and an eligible credit-card amount correction.

## 12. Documentation and rollout

- Update Veyra README from read-only to correction-capable and document both
  Core transactions endpoints.
- Update Core README with request/response contracts, user-scoping rules, and
  credit-card edit side effect.
- Keep migrations out of scope unless implementation proves an index is needed;
  measure query behavior before adding one.
- Deployment order: Core first, then Veyra. Until Core endpoints are live, Veyra
  must show unavailable rather than fall back to overview-only or fixture data.

## 13. Implementation boundary

Core work stays in `/home/unmeii/apps/core-api` and is delegated to its dedicated
subagent. Veyra work stays in `/home/unmeii/apps/veyra`. Each repository follows
its own instructions, test-first workflow, review, and verification. Existing
unrelated worktree changes must remain untouched.
