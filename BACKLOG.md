# Veyra Backlog

This file is the single authority for current open work. An item is active only
when it appears under **Current work** below. Checklists in
[`docs/superpowers/plans`](docs/superpowers/plans/) are historical execution
records; checked or unchecked boxes there do not represent the current backlog.

## Current work

### B-001 — Integrate the Core API contract fixture

- **Status:** Pending integration (Task 2 is complete in a separate worktree).
- **Evidence:** Task 2 added a versioned, de-identified provider payload and
  fixture-driven `loadOverview` acceptance and drift tests. Its focused tests,
  full test suite, production build, and diff check passed in that worktree.
- **Dependencies:** Bring the Task 2 fixture/test artifacts into the
  integration branch without overwriting unrelated work.
- **Complete when:** The fixture and acceptance tests are integrated, the full
  test suite and production build pass on the integrated revision, and the
  fixture remains de-identified. This item does not claim live-production API
  compatibility; that evidence belongs to B-003.

### B-002 — Add contributor setup and operations documentation

- **Status:** Planned for Task 4.
- **Evidence:** The repository has no README, while setup knowledge is spread
  across source, Compose, the deployment workflow, and historical plans.
- **Dependencies:** Confirm B-001's integration state and document commands for
  the revision that Task 4 targets.
- **Complete when:** A concise root README documents prerequisites, environment
  variables, local development, tests/build, container use, Core API and
  Telegram integration boundaries, deployment workflow, and links to this
  backlog without presenting historical plans as active work.

### B-003 — Verify live integrations, deployment, and weekly review scheduling

- **Status:** External verification pending; planned for Task 5.
- **Evidence:** Source and history prove the Core loader, Telegram OIDC routes,
  deployment workflow, and weekly review prompt exist. The latest project review
  does not prove live Core compatibility, the deployed revision and environment,
  production Telegram authentication, or an installed and successful cron run.
- **Dependencies:** Authorized access to the production host, deployment/CI
  configuration, Telegram OIDC configuration, live Core API, and scheduler logs.
- **Complete when:** Evidence identifies the deployed revision; validates the
  required environment names without exposing secrets; exercises production
  Telegram sign-in and Core overview loading; confirms the deployment workflow's
  expected target; and proves the weekly cron entry plus a recent successful run.

### B-004 — Replace provisional brand assets and font

- **Status:** Blocked on supplied assets and licensing.
- **Evidence:** The checked-in logo, portrait/avatar artwork, and typography are
  explicitly recorded as provisional in the project review and design QA.
- **Dependencies:** Approved final logo and portrait/avatar files plus a licensed
  font file (or an approved system-font decision).
- **Complete when:** Approved assets replace the provisional files, licensing is
  documented, asset/static checks pass, the production build passes, and visual
  QA confirms the login and dashboard at the supported responsive sizes.

## Historical plan register

These files explain how existing behavior was implemented. Their top-level
status notices are authoritative for interpreting their checklists.

| Plan | Reconciled status | Current follow-up |
| --- | --- | --- |
| [Overview dashboard](docs/superpowers/plans/2026-07-24-veyra-overview-dashboard.md) | Repository implementation complete; historical | B-004 for final brand assets/font |
| [GitHub Actions VPS deployment](docs/superpowers/plans/2026-07-25-github-actions-vps-deployment.md) | Repository workflow complete; historical | B-003 for external verification |
| [Demo login](docs/superpowers/plans/2026-07-25-veyra-demo-login.md) | Repository implementation complete and superseded by Telegram OIDC; historical | None |
| [Local container](docs/superpowers/plans/2026-07-25-veyra-local-container.md) | Repository implementation complete; historical | B-003 for current production evidence |
| [Nexus Core integration](docs/superpowers/plans/2026-07-25-veyra-nexus-core-integration.md) | Repository implementation complete; historical | B-001 and B-003 |
| [Telegram OIDC](docs/superpowers/plans/2026-07-26-veyra-telegram-oidc.md) | Repository implementation complete; historical | B-003 for production verification |
| [Credit-card summary](docs/superpowers/plans/2026-07-29-veyra-credit-card-summary.md) | Repository implementation complete; historical | B-001 for fixture integration |
| [Weekly repository review](docs/superpowers/plans/2026-07-31-weekly-repository-review.md) | Repository artifacts complete; historical | B-003 for cron verification |

## Maintenance rule

Add, update, or close current work only in this file. New implementation plans
may describe execution, but must link here and must not become a second backlog.
When work is complete, record the evidence in repository history and remove it
from **Current work** (or move it to a short completed record if that context is
still useful).
