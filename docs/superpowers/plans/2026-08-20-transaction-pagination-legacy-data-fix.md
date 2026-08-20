# Transaction Pagination Legacy-Data Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load every finalized transaction page when legacy expenses have missing merchant or category metadata, without weakening expense edit validation.

**Architecture:** Relax only the existing read-boundary parsers in Core and Veyra so nullable legacy metadata can reach the existing table fallbacks. Keep the current cursor flow, uncached retry, and write-boundary validation unchanged.

**Tech Stack:** NestJS 10, TypeScript 5, Node test runner, Next.js 16, React 19

**Spec:** `docs/superpowers/specs/2026-08-13-transaction-pagination-legacy-data-design.md`

## Global Constraints

- No database migration or production-record mutation.
- No new dependency, abstraction, retry mechanism, route, or visual component.
- Preserve strict validation for identifiers, amounts, enums, timestamps, text lengths, and booleans.
- Expense edits must still require a non-empty merchant and category.
- Preserve unrelated dirty work in both repositories.

## File Map

### Core API repository: `/home/unmeii/apps/core-api`

- Modify `src/veyra/transactions/web-transactions.service.spec.ts`: prove legacy nullable expense metadata is readable and retain rejection of unsafe overlong text.
- Modify `src/veyra/transactions/web-transaction-public-contract.ts`: remove only the expense metadata completeness rejection from the shared public response mapper.

### Veyra repository: `/home/unmeii/apps/veyra`

- Modify `tests/transaction-contract.test.ts`: prove the client accepts nullable expense metadata while retaining edit validation.
- Modify `src/lib/transaction-contract.ts`: remove only the expense metadata completeness rejection from the shared response parser.

---

### Task 1: Core reads legacy expense metadata

**Files:**
- Modify: `/home/unmeii/apps/core-api/src/veyra/transactions/web-transactions.service.spec.ts:386-427`
- Modify: `/home/unmeii/apps/core-api/src/veyra/transactions/web-transaction-public-contract.ts:13-31`

**Interfaces:**
- Consumes: `WebTransactionsService.queryTransactions(request): Promise<WebTransactionsQueryResponseDto>` and the existing `row()`/`createService()` test helpers.
- Produces: the unchanged public `WebTransactionDto` shape, with `merchant` and `category` nullable for both income and expense records.

- [ ] **Step 1: Write the failing read-boundary regression test**

Add this test after `web transactions service trims legacy public text and deduplicates category options`:

```typescript
test('web transactions service exposes incomplete legacy expense metadata as null', async () => {
  const { repository, service } = createService();
  repository.rows = [
    row({ merchant: null }),
    row({ id: '122', merchant: ' ', category: null }),
  ];

  const result = await service.queryTransactions({
    telegramUserId: '976684739',
  });

  assert.deepEqual(
    result.items.map(({ merchant, category }) => ({ merchant, category })),
    [
      { merchant: null, category: 'Dining' },
      { merchant: null, category: null },
    ],
  );
});
```

- [ ] **Step 2: Run the focused Core test and verify RED**

Run:

```bash
cd /home/unmeii/apps/core-api
rtk npm exec tsc -- -p tsconfig.test.json
rtk node --test --test-name-pattern="exposes incomplete legacy expense metadata as null" dist-test/src/veyra/transactions/web-transactions.service.spec.js
```

Expected: FAIL because `toPublicWebTransaction()` throws `InternalServerErrorException` for the first incomplete expense.

- [ ] **Step 3: Remove only the read-boundary completeness rejection**

In `toPublicWebTransaction()`, delete this block:

```typescript
if (type === 'expense' && (merchant === null || category === null)) {
  invalidPublicData();
}
```

Keep `type`, `merchant`, and `category` validation and the returned DTO unchanged.

In `web transactions service rejects stored text that cannot satisfy the public contract`, remove `row({ merchant: ' ' })` from `invalidRows`; keep the over-200-character row and category-option assertions because those remain unsafe.

- [ ] **Step 4: Run focused Core coverage and verify GREEN**

Run:

```bash
cd /home/unmeii/apps/core-api
rtk npm exec tsc -- -p tsconfig.test.json
rtk node --test --test-name-pattern="legacy expense metadata|stored text|update returns not found conflict invalid" dist-test/src/veyra/transactions/web-transactions.service.spec.js dist-test/src/veyra/transactions/web-transactions.repository.spec.js
```

Expected: PASS. The existing repository update scenario with `{ merchant: null }` still returns `kind: 'invalid'`, proving the write boundary is unchanged.

- [ ] **Step 5: Run Core lint, full tests, and build**

Run:

```bash
cd /home/unmeii/apps/core-api
rtk npm run lint
rtk npm test
rtk npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit only the Core fix files**

```bash
cd /home/unmeii/apps/core-api
git add src/veyra/transactions/web-transaction-public-contract.ts src/veyra/transactions/web-transactions.service.spec.ts
git commit -m "fix: allow legacy transaction metadata"
```

Do not stage the repository's pre-existing README, watchdog, email parser, or transaction service changes.

---

### Task 2: Veyra renders legacy expense metadata

**Files:**
- Modify: `/home/unmeii/apps/veyra/tests/transaction-contract.test.ts:1-120`
- Modify: `/home/unmeii/apps/veyra/src/lib/transaction-contract.ts:146-167`

**Interfaces:**
- Consumes: `parseTransaction(value: unknown): Transaction` and the existing `expense` test fixture.
- Produces: the unchanged `Transaction` type, with nullable `merchant` and `category` accepted for both transaction types.

- [ ] **Step 1: Write the failing client-contract regression test**

Add this test beside the existing response parsing tests:

```typescript
test('accepts incomplete legacy expense metadata for display', () => {
  const parsed = parseTransaction({
    ...expense,
    merchant: null,
    category: null,
  });

  assert.equal(parsed.type, 'expense');
  assert.equal(parsed.merchant, null);
  assert.equal(parsed.category, null);
});
```

The expected values are literals independent of the parser implementation.

- [ ] **Step 2: Run the focused Veyra test and verify RED**

Run:

```bash
cd /home/unmeii/apps/veyra
rtk node --test --test-name-pattern="accepts incomplete legacy expense metadata for display" tests/transaction-contract.test.ts
```

Expected: FAIL with `Invalid expense metadata`.

- [ ] **Step 3: Remove only the client read-boundary completeness rejection**

In `parseTransaction()`, delete this block:

```typescript
if (type === "expense" && (!merchant || !category)) {
  throw new Error("Invalid expense metadata");
}
```

Keep `nullableText()` and all remaining field validation unchanged. Do not modify `editText()` or `parseTransactionEditForm()`.

- [ ] **Step 4: Run focused Veyra coverage and verify GREEN**

Run:

```bash
cd /home/unmeii/apps/veyra
rtk node --test tests/transaction-contract.test.ts tests/static.test.mjs
```

Expected: PASS. The existing `requires merchant and category text for expense edits` test remains green, and static coverage retains `Unknown merchant`, `Uncategorized`, and `router.refresh()`.

- [ ] **Step 5: Run Veyra full tests and build**

Run:

```bash
cd /home/unmeii/apps/veyra
rtk npm test
rtk npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit only the Veyra fix files**

```bash
cd /home/unmeii/apps/veyra
git add src/lib/transaction-contract.ts tests/transaction-contract.test.ts
git commit -m "fix: render legacy transaction metadata"
```

Do not stage the pre-existing `PROJECT_REVIEW.md` change.

---

## Post-deployment verification

Deployment is outside this implementation plan. When separately authorized,
deploy Core before Veyra, then repeat the established privacy-preserving
pagination probe. Print only stage, HTTP status, item count, cursor presence,
and aggregate failure counts—never identities, cursors, or transaction data.
Every queried page should return HTTP 200 and `secondPageFailures` should be
`0`.
