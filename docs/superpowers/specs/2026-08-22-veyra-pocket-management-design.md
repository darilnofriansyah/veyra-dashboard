# Veyra Pocket Management Design

**Date:** 2026-08-22

## Goal

Add a direct **Pockets** destination where an authenticated Veyra user can list pockets, create a pocket with a monthly budget, rename a pocket, change its budget, and choose the default pocket.

Core remains authoritative for pocket identity, persistence, budget amounts, and default-pocket rules.

## Scope

### Included

- Direct `/pockets` link beside Overview and Transactions
- Responsive pocket list with name, full-IDR budget, and default status
- Create a pocket with a name and positive whole-rupiah monthly budget
- Rename an existing pocket
- Change an existing pocket's positive whole-rupiah monthly budget
- Set an existing pocket as default
- Loading, empty, validation, unavailable, and success states

### Excluded

- Pocket deletion or archival until Core exposes that operation
- Removing a budget or setting it to `null`; Core's upsert requires a positive amount
- Child/category budget management
- Reimplementing spending or budget calculations in Veyra

## User Experience

The existing application shell gains a third direct navigation item, **Pockets**, with `/pockets` as its destination and the same active-link, keyboard-focus, mobile wrapping, and `aria-current` behavior as the existing links.

The page follows Veyra's current cyan, navy, slate, spacing, border, and radius conventions. A compact header introduces the page and provides **Add pocket**. The list shows one responsive card or row per pocket:

- pocket name
- budget formatted with the existing IDR formatter, or **No budget set** for Core-created amount-less pockets
- a text-and-icon **Default** marker where applicable
- **Rename**, **Set budget**, and, when applicable, **Make default** actions

Native dialogs/forms are used for add, rename, and budget changes, following the established transaction-edit interaction: accessible labels and descriptions, initial focus, inline field errors, pending controls, and focus returned to the trigger on close. Narrow layouts stack content without page-level horizontal overflow.

Create and update operations stay separate so each maps to one authoritative Core mutation. The UI does not present a combined save that could partially rename a pocket while failing to update its budget.

## Data Flow and Contracts

### Read

The protected `/pockets` server page verifies the existing signed session and calls the current pocket list API with the verified Telegram user ID:

```text
POST /api/veyra/budgets/pockets/list
{ userId: telegramUserId }
```

Veyra continues strict validation of `{ status: "ok", pockets }`, where each pocket contains `id`, `name`, nullable `amount`, and `isDefault`.

### Create and budget update

Veyra reuses the current budget upsert endpoint rather than adding a duplicate Pocket create API:

```text
POST /api/veyra/budgets/upsert
{ telegramUserId, category: pocketName, amount, periodType: "monthly" }
```

For a budget update, the server action first reloads the authenticated user's pockets, finds the submitted pocket ID, and supplies Core's current pocket name as `category`. Browser input therefore cannot select another user's identity or silently choose an arbitrary upsert key.

### Rename and default

Veyra uses the current Pocket endpoints:

```text
POST /api/veyra/budgets/pockets/rename
{ telegramUserId, pocketId, name }

POST /api/veyra/budgets/pockets/default
{ telegramUserId, pocketId }
```

### Core identity compatibility

Existing Core write DTOs use an internal `userId`, while Veyra's verified session contains only a Telegram user ID. Core will extend the existing upsert, rename, and default request contracts with an explicit `telegramUserId` alternative. Exactly one identity field is accepted. When `telegramUserId` is supplied, Core resolves the active internal user server-side before any budget mutation. Existing internal `userId` callers remain compatible, and Veyra never exposes or accepts an internal user ID from browser input.

No new Pocket create endpoint is introduced.

## Server Actions and Validation

All mutations run in server actions. Each action:

1. verifies the signed Veyra session
2. derives `telegramUserId` from that session only
3. parses exactly one value for every expected form field
4. validates positive numeric pocket IDs, trimmed names of at most 200 characters, and positive safe-integer rupiah amounts
5. calls the matching Core API with a five-second timeout and server-only API key
6. revalidates `/pockets`, `/transactions`, and `/dashboard` after success

Core validation remains authoritative. Veyra maps known validation and not-found responses to field/action feedback and maps malformed responses, timeouts, and unexpected statuses to a generic unavailable state without leaking upstream details.

## State Handling

- **Loading:** route-level skeleton matching the final list structure
- **Empty:** explains that no pockets are available and offers **Add pocket**
- **Unavailable:** does not show an empty list as truth; offers retry
- **Validation:** keeps the dialog open, associates messages with fields, and focuses the first invalid field
- **Not found:** explains that the pocket changed or no longer exists and refreshes the list
- **Success:** closes the dialog, refreshes affected routes, and announces the completed action through an `aria-live` status
- **Default action:** disabled for the current default and never communicates state by color alone

## Code Shape

Veyra will reuse the existing `AppShell`, IDR formatter, session verification, request timeout/header conventions, and server-action patterns. Pocket-specific parsing and API calls stay together rather than expanding the transaction contract further. One client page component owns the small amount of dialog state; no state library or new dependency is added.

Core changes remain limited to identity normalization for the three existing write contracts and their tests.

## Testing

Implementation follows red-green-refactor with focused Node tests:

- Pocket contract/form tests for valid and malformed names, IDs, and rupiah amounts
- Pocket API tests for list, upsert, rename, default, response validation, timeout, and status mapping
- Server-action/static checks proving session-derived identity and route revalidation
- Navigation/UI checks for the direct link, active state, accessible labels/status, and truthful empty/unavailable states
- Core service/controller tests proving `telegramUserId` resolution, exact-one identity validation, existing `userId` compatibility, and no mutation for unknown/inactive Telegram users

Targeted tests run while iterating, followed by each repository's relevant test suite. Production builds and Docker rebuilds remain excluded unless explicitly requested.
