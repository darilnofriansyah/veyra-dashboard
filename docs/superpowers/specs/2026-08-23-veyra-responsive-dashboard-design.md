# Veyra Responsive Dashboard Design

## 1. Goal

Give Overview, Transactions, and Pockets one clear financial hierarchy across
desktop, mobile browser, and Telegram Mini App viewports. Reduce repeated card
chrome, shorten mobile scanning, and preserve all current Core-owned behavior,
authentication, error truthfulness, and accessibility.

## 2. Product Boundary

This work changes presentation and interaction only.

- Keep current Core endpoints, request fields, response fields, validation, and
  Jakarta date semantics unchanged.
- Keep current Telegram OIDC, Mini App session exchange, route protection, and
  server-only Core access unchanged.
- Add no transaction-ingestion path, financial calculation, dependency, dark
  theme, delete/archive action, or speculative data.
- Preserve full IDR formatting and status text; color never carries meaning
  alone.

## 3. Shared Visual System

- Keep the approved system-sans fallback. `BACKLOG.md` B-004 owns final font
  selection and remains blocked on an approved font or explicit system-font
  decision; this refresh does not bypass that gate.
- Keep Veyra navy, slate, white, and cyan. Cyan is the sole non-semantic accent.
  Success, warning, and danger remain semantic exceptions.
- Replace purple category colors with a navy-to-cyan tonal sequence plus slate.
- Keep existing radius token. Reduce generic card repetition using grouped
  surfaces, dividers, and negative space where elevation is unnecessary.
- Keep tabular numerals for all financial comparisons and table/list amounts.
- Add `text-pretty` or `text-balance` to page headings and descriptive copy.
- Add active feedback to buttons and links without continuous or decorative
  motion. All transitions remain reduced-motion safe and name only changed CSS
  properties.

## 4. Shared Shell

Desktop at `xl` and wider keeps the 216px sidebar.

Below `xl`, render a compact top bar containing brand and account/sign-out
context. Below the `md` breakpoint (767px and narrower), use a fixed three-item
bottom navigation for both normal browser and Telegram Mini App contexts.
Telegram continues hiding its
redundant brand/account block; normal browser keeps the compact top bar so
account and sign-out remain reachable.

Bottom navigation must:

- use semantic Next.js links with `aria-current="page"`
- retain text labels and icons
- meet a minimum 44px touch target
- reserve page padding so it never covers content
- include `env(safe-area-inset-bottom)` in every mobile context
- keep focused elements visible above fixed navigation

This supersedes the narrow-layout clause in
`2026-08-22-veyra-telegram-mini-app-design.md` that preserves the existing
normal-browser mobile shell. Telegram runtime behavior otherwise stays intact.

## 5. Overview

Replace four equal KPI cards followed by a full-width credit card with one
Financial Pulse section.

Desktop layout:

- primary two-thirds area: Net Cashflow as lead value
- supporting values: Total Income, Total Spent, Daily Average Spend
- secondary one-third area: Amount to Pay, Credit Used, utilization progress
- alert status appears beside or directly below the pulse, before analytical
  charts

Mobile layout:

- one outer column with Net Cashflow first
- compact two-column supporting metric grid inside the pulse; fall back to one
  column at 320px or under high text zoom
- credit amount and utilization immediately after metrics
- alert before trend, category, budget, and transaction detail
- Recent Transactions becomes a compact semantic list rather than a squeezed
  table

Keep period selection, comparison logic, accessible trend points, budget
progress names, empty/error states, and Veyra insight content unchanged.

## 6. Transactions

Desktop keeps the full semantic table and side-panel editor.

Below `md`:

- show merchant and signed amount as first row of each transaction
- show date, category, and pocket as secondary metadata
- retain source and type as accessible text when not visually repeated
- make one explicit Edit button available per record
- do not require horizontal page or table scrolling

Filters remain URL-owned. Mobile shows merchant search plus one `Filters`
button with active-count text. Expanded filter controls use the existing form,
native fields, and Apply action. Active filter chips stay removable and may
scroll horizontally within their own region without widening the page.

Desktop retains the current always-visible filter grid. Loading skeletons must
match table on desktop and transaction rows on mobile.

## 7. Pockets

Use a divided list rather than independently elevated cards. Pocket name and
monthly budget remain primary information. Default status remains visible text.

Desktop may keep explicit Rename, Set Budget, and Make Default actions. Mobile
uses one accessible actions disclosure per pocket to avoid wrapped button rows.
Use native `<details>/<summary>` for the smallest dependency-free disclosure;
actions remain real buttons/forms. Only one destructive-looking affordance is
avoided because no destructive action exists.

Add Pocket remains the page's primary action. At mobile widths it becomes full
width below the page introduction.

## 8. Dialogs and Forms

- Desktop transaction editor remains a right side panel.
- Both transaction and pocket dialogs become full-width, full-height sheets at
  640px and below, bounded by `100dvh` and safe-area insets.
- Add `overscroll-behavior: contain` to dialog scroll regions.
- Keep focus return, first-validation-error focus, native dialog cancel, pending
  lockout, and inline status messages.
- Add `autoComplete="off"` to non-auth editing fields.
- When transaction form is dirty, closing or navigating away requires explicit
  discard confirmation. No warning appears when clean or after successful save.

## 9. Loading, Empty, and Error States

Every loading route mirrors its final responsive structure. Skeleton motion
stops under reduced motion. Empty and error states keep current truthful copy,
local retry behavior, and no stale derived financial values.

No perpetual animation, magnetic button, carousel, or new motion dependency is
included. Motion adds no decision value here.

## 10. Accessibility and Web Guidelines

- Preserve global `:focus-visible`, skip links, semantic controls, accessible
  chart values, and live-region announcements.
- Add `touch-action: manipulation` to interactive controls and intentional tap
  highlight styling.
- Keep inputs labeled and named; preserve inline field errors.
- Ensure headings wrap cleanly and long merchant, category, pocket, and account
  names cannot widen the viewport.
- Keep native zoom enabled.
- Fixed navigation and sheets must not obscure focused controls at 200% zoom.
- Do not use `transition: all`, gesture-only controls, icon-only buttons without
  labels, or client-side layout measurement.

## 11. Acceptance

Automated checks must prove:

- shared shell exposes desktop sidebar, normal-browser mobile top bar, and
  shared mobile bottom navigation
- Overview renders one Financial Pulse and keeps existing financial values and
  accessible states
- Transactions render desktop table and mobile semantic records from the same
  data without duplicate interactive IDs
- mobile filter disclosure preserves URL filter behavior
- Pockets use semantic mobile action disclosures and existing server actions
- both dialogs expose safe-area/overscroll rules and transaction discard guard
- loading routes contain responsive structures matching final pages
- existing auth, Core contract, transaction, pocket, and Telegram tests pass

Manual checks at 320x568, 375x812, 767x1024, 1024x768, and 1440x900 must show:

- no page-level horizontal overflow
- readable 200% text zoom at 375px
- keyboard navigation and visible focus throughout
- bottom navigation clear of content and software-keyboard/dialog actions
- truthful loading, empty, error, populated, and selected/editing states
- Telegram Android, iOS, and Desktop safe-area behavior unchanged except for the
  shared mobile navigation design

## 12. Non-Goals

- Core or API changes
- authoritative pocket spending or utilization calculations not supplied by Core
- transaction creation
- pocket delete/archive
- dark mode
- final font or brand-asset replacement owned by B-004
- chart library, component framework, motion library, or state library
- production build on the VPS
- deployment, container restart, or external Telegram changes
