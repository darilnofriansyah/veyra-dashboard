# Codex prompt: add combined credit-card data to Core API dashboard

Work in the Core API repository.

Before editing:

1. Read repository instructions.
2. Check worktree status and preserve existing changes.
3. Fetch `origin/main` and sync the working branch with it according to the
   repository's merge/rebase policy.
4. Inspect the current dashboard endpoint, financial-cycle calculation,
   persistence layer, migrations, and tests before choosing files.

Extend `POST /api/veyra/dashboard/overview` so both `current` and `previous`
contain this required object:

```ts
creditCard: {
  limit: number;
  used: number;
  statementBalance: number;
}
```

Requirements:

- Support one combined credit-card summary per user and billing cycle.
- Do not model individual cards and do not return an array.
- Store and return non-negative, safe IDR integers.
- `limit` is combined credit limit.
- `used` is combined credit used for that cycle.
- `statementBalance` is the full amount billed when that cycle closes.
- Return `{ limit: 0, used: 0, statementBalance: 0 }` when no summary exists.
- Add the smallest database uniqueness constraint, following existing schema
  conventions, that prevents multiple summaries for the same user and cycle.
- Preserve existing authentication, timezone, cycle boundaries, response
  fields, and error behavior.
- Do not store a derived percentage. Veyra calculates it from `used / limit`.
- Do not add card metadata, minimum payments, due dates, or another endpoint.

Use the repository's standard test-first workflow. First add failing tests for:

- persistence and uniqueness;
- current and previous cycle mapping;
- zero fallback;
- negative or otherwise invalid amounts;
- exact dashboard response shape.

Then implement the smallest passing change. Run targeted tests, full tests,
lint/typecheck, and production build using repository-standard commands. Review
the final diff for unrelated changes and report the migration, endpoint contract,
verification commands, and results.
