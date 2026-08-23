# Veyra Backlog

This file is the single authority for current open work. An item is active only
when it appears under **Current work** below. Checklists in
[`docs/superpowers/plans`](docs/superpowers/plans/) are historical execution
records; checked or unchecked boxes there do not represent the current backlog.

## Current work

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

### B-005 — Deliver transaction list and corrections

- **Status:** Active; implementation and automated cross-repository verification
  completed on 2026-08-13, awaiting real-browser interaction QA only.
- **Evidence:** Veyra's full suite passed 12/12 test files, its production build
  passed with `/transactions` in the route output, and TypeScript plus diff
  checks passed. Core at `5cf383d` passed 460/460 tests, lint, build, and diff
  checks. Query/PATCH paths, filters, cursors, cycle and as-of semantics,
  request/response fields, nullability, timestamps, categories, status mapping,
  and credit-card behavior match across repositories. Real-browser QA could not
  run because no browser, Playwright installation, authenticated session, or
  controllable Core fixture was available.
- **Dependencies:** Deploy the Core transaction query and PATCH endpoints before
  Veyra. Provide a browser test environment, authenticated fixture, and
  controllable Core responses for final interaction QA.
- **Complete when:** Desktop/mobile layout, URL history and cursor navigation,
  keyboard dialog behavior and focus, result states, reduced motion, responsive
  transaction table/list switching, and positive/negative credit-card delta notes
  pass in a real browser.

### B-003 — Verify live integrations, deployment, and weekly review scheduling

- **Status:** Partially verified on 2026-08-11; controlled end-to-end checks remain.
- **Evidence:** The
  [operations verification report](docs/operations-verification-2026-08-11.md)
  confirms the production checkout, latest successful deployment workflow,
  running containers, local and public root responses, Core network reachability,
  expected environment-name presence, and the installed weekly schedule. It does
  not prove a complete Telegram login, an authorized Core overview request, or a
  successful weekly-review outcome.
- **Dependencies:** An authorized Telegram test identity, an approved
  non-sensitive Core smoke-test identity, and secret-safe scheduler-log review.
- **Complete when:** A controlled production Telegram sign-in and authorized Core
  overview request succeed, and a recent weekly-review run is proven successful
  through secret-safe evidence.

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
| [GitHub Actions VPS deployment](docs/superpowers/plans/2026-07-25-github-actions-vps-deployment.md) | Repository workflow and latest deployment verification complete; historical | None |
| [Demo login](docs/superpowers/plans/2026-07-25-veyra-demo-login.md) | Repository implementation complete and superseded by Telegram OIDC; historical | None |
| [Local container](docs/superpowers/plans/2026-07-25-veyra-local-container.md) | Repository implementation and production runtime verification complete; historical | None |
| [Nexus Core integration](docs/superpowers/plans/2026-07-25-veyra-nexus-core-integration.md) | Repository implementation and contract coverage complete; historical | B-003 for authorized live verification |
| [Telegram OIDC](docs/superpowers/plans/2026-07-26-veyra-telegram-oidc.md) | Repository implementation complete; historical | B-003 for production verification |
| [Credit-card summary](docs/superpowers/plans/2026-07-29-veyra-credit-card-summary.md) | Repository implementation and contract coverage complete; historical | None |
| [Weekly repository review](docs/superpowers/plans/2026-07-31-weekly-repository-review.md) | Repository artifacts and cron schedule verification complete; historical | B-003 for successful-run evidence |

## Completed this week

| Item | Completed | Evidence |
| --- | --- | --- |
| B-001 — Integrate the Core API contract fixture | 2026-08-11 | Versioned de-identified fixture and fixture-driven acceptance/drift tests are integrated; the full suite and production build pass. |
| B-002 — Add contributor setup and operations documentation | 2026-08-11 | The root README documents prerequisites, configuration, local and container workflows, integration boundaries, deployment, and operations. |

## Maintenance rule

Add, update, or close current work only in this file. New implementation plans
may describe execution, but must link here and must not become a second backlog.
When work is complete, record the evidence in repository history and remove it
from **Current work** (or move it to a short completed record if that context is
still useful).
