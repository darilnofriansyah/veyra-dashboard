# Transaction Pagination Legacy-Data Fix Design

**Date:** 2026-08-13  
**Status:** Approved for implementation planning  
**Repositories:** `veyra` and `core-api`

## Purpose

Make every finalized transaction page load when older expense records have no
merchant, while preserving strict validation for newly edited expense data.

The observed failure is deterministic rather than a Next.js refresh problem.
The running Core API returns HTTP 500 with `Transaction data is invalid` when a
page includes a legacy confirmed expense whose merchant is null or blank.
Veyra converts that response into its safe unavailable state. Retry correctly
makes another uncached request, but the same data produces the same response.

## Approved approach

Treat missing merchant or category values as displayable legacy data at the
read boundary:

- Core may return `merchant: null` and `category: null` for finalized income or
  expense records.
- Veyra accepts those nullable fields for either transaction type.
- The transaction table continues to display its existing `Unknown merchant`
  and `Uncategorized` fallbacks.
- Editing an expense continues to require both merchant and category. Core and
  Veyra keep their current write validation, so a correction cannot preserve or
  introduce incomplete expense metadata.
- Retry remains `router.refresh()`. Its current behavior is correct for
  transient failures because the transaction request uses `cache: "no-store"`.

This approach exposes legacy records so users can correct them. Filtering them
out would hide financial activity and distort pagination. Backfilling a made-up
merchant would alter financial data without evidence.

## Component changes

### Core API

Remove the expense-only merchant/category completeness check from the public
transaction response mapper. Keep all other public validation, including IDs,
positive safe-integer amounts, supported types and sources, timestamps, text
length limits, and booleans.

Do not change update validation. An expense update with a missing merchant or
category remains invalid.

### Veyra

Remove the expense-only merchant/category completeness check from the
transaction response parser. Keep the nullable-text validation and all other
contract checks.

No visual or navigation changes are needed. Existing row fallbacks already
provide safe labels, and the edit form already requires complete expense
metadata.

## Data flow

1. Veyra requests the selected transaction page with the verified Telegram
   identity, active filters, opaque cursor, and `cache: "no-store"`.
2. Core queries finalized records and maps a legacy blank merchant to `null`.
3. Core returns HTTP 200 with the complete page and pagination cursors.
4. Veyra accepts the nullable field and renders `Unknown merchant`.
5. If the user edits that expense, both applications require a non-empty
   merchant and category before persisting the correction.

## Error handling

Network failures, timeouts, non-200 responses, malformed payloads, and unsafe
field values continue to produce Veyra's generic unavailable state. No upstream
error body or personal transaction data is exposed. Retry continues to repeat
the exact current URL request.

The fix does not alter production records or perform a data migration.

## Testing

Use test-driven development in both repositories:

- Core public-contract coverage proves a finalized expense with a null merchant
  is emitted successfully.
- Core service coverage proves such a row does not turn the query into HTTP 500
  behavior, while update tests continue to reject incomplete expense edits.
- Veyra contract coverage proves an expense with nullable merchant/category is
  accepted.
- Existing Veyra static coverage continues to prove the neutral row fallbacks,
  current retry behavior, and expense edit requirements.
- Run focused tests, each repository's full test suite, and both production
  builds before completion.

## Release and verification

Deploy Core before Veyra so the upstream query can return legacy records before
the client accepts them. After deployment, verify first and next transaction
pages, confirm the formerly failing page returns records, and confirm editing a
legacy expense requires completing its merchant and category.

No database cleanup is part of this change. Any later backfill must be designed
separately from evidence about the actual merchants.
