# Veyra Overview Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Veyra Overview dashboard in Next.js and Tailwind CSS, matching the supplied landing-page style while keeping the first release read-only and data-first.

**Architecture:** Use Next.js 16 App Router with a server-rendered shell and one client Overview component for the month selector. Pure TypeScript modules own fixtures and financial calculations. Tailwind CSS v4 tokens in `globals.css` carry the landing-page palette, typography, borders, radii, and responsive behavior into the dashboard.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript 5, Tailwind CSS v4 with `@tailwindcss/postcss`, Node.js 24 built-in tests, Next Image, ImageGen, and development-only `sharp`.

## Global Constraints

- Implement only the authenticated Overview page.
- Use the App Router under `src/app`; do not add Pages Router files.
- Use React Server Components by default; only `OverviewDashboard` is a client component.
- Use English UI and whole IDR values with locale `en-ID`, currency `IDR`, and `currencyDisplay: "code"`.
- Period choices are exactly `This Month` and `Last Month`.
- Use `Asia/Jakarta` for dates and month boundaries.
- Match the landing-page language from Design 2: white canvas, near-black/navy type, cool-gray borders, cyan focus, restrained purple chart accent.
- Tailwind v4 configuration is CSS-first with `@import "tailwindcss"` and `@theme`; do not add `tailwind.config.js`.
- Do not add a component library, state library, chart library, API abstraction, or icon package.
- Use native HTML controls, tables, progress elements, and data-driven SVG charts.
- Keep Veyra secondary to financial data and never use Veyra artwork as the signed-in user.
- Use only an original Veyra logo file; never crop or redraw it from the references.
- Keep fixture data fictional and never log financial payloads.
- Meet WCAG AA, preserve visible focus, and respect reduced motion.
- Current workspace Git metadata is unavailable. Commit steps require a writable Git checkout.

---

## File map

| Path | Responsibility |
|---|---|
| `package.json` | Next, Tailwind, test, build, and image scripts |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `tsconfig.json` | Strict Next.js TypeScript configuration |
| `next-env.d.ts` | Next.js TypeScript declarations |
| `src/app/layout.tsx` | Metadata, language, global stylesheet, and app frame |
| `src/app/page.tsx` | Server page that renders the Overview feature |
| `src/app/globals.css` | Tailwind import, Veyra theme tokens, and minimal base rules |
| `src/components/overview-dashboard.tsx` | Period state, cards, budgets, transactions, alerts, and local states |
| `src/components/spending-trend.tsx` | Accessible daily-spend SVG |
| `src/components/category-breakdown.tsx` | Accessible category donut and legend |
| `src/lib/finance.ts` | Validation, period filtering, IDR formatting, summaries, alerts, and insight |
| `src/lib/fixtures.ts` | Relative fictional current/previous-month data |
| `tests/finance.test.ts` | Financial logic and boundary checks |
| `tests/static.test.mjs` | Next/Tailwind structure and forbidden-feature checks |
| `tests/assets.test.mjs` | Portrait and logo metadata checks |
| `scripts/optimize-art.mjs` | Transparent PNG to application WebP |
| `public/assets/veyra-logo.svg` | Owner-supplied original logo |
| `public/assets/veyra-mark.svg` | Owner-supplied original mark |
| `public/assets/veyra-dashboard-portrait.png` | Lossless transparent master |
| `public/assets/veyra-dashboard-portrait.webp` | Optimized runtime image |

---

### Task 1: Next.js, Tailwind, and financial core

**Files:**
- Create: `package.json`
- Create: `postcss.config.mjs`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `src/app/globals.css`
- Create: `src/lib/finance.ts`
- Create: `tests/finance.test.ts`

**Interfaces:**
- Produces: `formatIdr(value: number): string`
- Produces: `summarizeOverview(input: OverviewInput): OverviewSummary`
- `period` is `"current" | "previous"`
- `now` is an ISO date string

- [ ] **Step 1: Install only the required runtime and build packages**

Run:

```bash
npm install next@16.2.9 react@19 react-dom@19
npm install --save-dev typescript@5 @types/node@24 @types/react@19 @types/react-dom@19 tailwindcss@4 @tailwindcss/postcss@4
```

Expected: `package.json` and `package-lock.json` contain Next 16.2.9, React 19, and Tailwind 4; no UI or chart package is installed.

Set scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Add Tailwind v4 and strict TypeScript configuration**

Create `postcss.config.mjs`:

```js
export default {
  plugins: ["@tailwindcss/postcss"],
};
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

Create `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-veyra-ink: #0b0e14;
  --color-veyra-navy: #121722;
  --color-veyra-navy-2: #182030;
  --color-veyra-cyan: #00b3ff;
  --color-veyra-purple: #a64dff;
  --color-veyra-line: #e6e8ef;
  --color-veyra-success: #067647;
  --color-veyra-warning: #9a6700;
  --color-veyra-danger: #b42318;
  --radius-veyra: 0.625rem;
  --font-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

@layer base {
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; background: #f6f8fb; color: var(--color-veyra-ink); font-variant-numeric: tabular-nums; }
  button, select { font: inherit; }
  :focus-visible { outline: 3px solid color-mix(in srgb, var(--color-veyra-cyan) 55%, white); outline-offset: 3px; }
}
```

- [ ] **Step 3: Write the failing finance tests**

Create `tests/finance.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatIdr, summarizeOverview, validateOverviewInput } from "../src/lib/finance.ts";

const transactions = [
  { id: "jul-income", date: "2026-07-01", merchant: "Salary", category: "Income", amount: 15_600_000, type: "income" as const },
  { id: "jul-food", date: "2026-07-05", merchant: "Grocer", category: "Food & Dining", amount: 1_800_000, type: "expense" as const },
  { id: "jul-ride", date: "2026-07-20", merchant: "Grab", category: "Transport", amount: 600_000, type: "expense" as const },
  { id: "jun-income", date: "2026-06-01", merchant: "Salary", category: "Income", amount: 14_000_000, type: "income" as const },
  { id: "jun-food", date: "2026-06-05", merchant: "Grocer", category: "Food & Dining", amount: 2_000_000, type: "expense" as const },
  { id: "jun-ride", date: "2026-06-20", merchant: "Grab", category: "Transport", amount: 800_000, type: "expense" as const }
];
const budgets = [
  { category: "Food & Dining", limit: 2_200_000 },
  { category: "Transport", limit: 1_000_000 }
];

test("formats IDR using Indonesian grouping", () => {
  assert.match(formatIdr(8_247_300), /^IDR\s8\.247\.300$/);
});

test("calculates one consistent current-month summary", () => {
  const result = summarizeOverview({ transactions, budgets, period: "current", now: "2026-07-24" });
  assert.equal(result.totalIncome, 15_600_000);
  assert.equal(result.totalSpent, 2_400_000);
  assert.equal(result.netCashflow, 13_200_000);
  assert.equal(result.dailyAverage, 100_000);
  assert.equal(result.budgets[0].percent, 82);
  assert.equal(result.alert?.category, "Food & Dining");
  assert.equal(result.comparison.totalSpent, 2_800_000);
});

test("uses full calendar days for a completed month", () => {
  const result = summarizeOverview({ transactions, budgets, period: "previous", now: "2026-07-24" });
  assert.equal(result.dailyAverage, Math.round(2_800_000 / 30));
});

test("rejects duplicate ids, invalid dates, and unsafe amounts", () => {
  assert.throws(
    () => validateOverviewInput({ transactions: [transactions[0], transactions[0]], budgets, period: "current", now: "2026-07-24" }),
    /duplicate transaction id/i
  );
  assert.throws(
    () => validateOverviewInput({ transactions: [{ ...transactions[0], id: "bad", date: "2026-02-31" }], budgets, period: "current", now: "2026-07-24" }),
    /invalid transaction date/i
  );
  assert.throws(
    () => validateOverviewInput({ transactions: [{ ...transactions[0], amount: -1 }], budgets, period: "current", now: "2026-07-24" }),
    /whole non-negative rupiah/i
  );
});
```

- [ ] **Step 4: Verify the tests fail**

Run:

```bash
npm test
```

Expected: FAIL because `src/lib/finance.ts` does not exist.

- [ ] **Step 5: Implement `src/lib/finance.ts`**

Implement the exact approved rules:

```ts
export type Period = "current" | "previous";
export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense";
};
export type Budget = { category: string; limit: number };
export type OverviewInput = { transactions: Transaction[]; budgets: Budget[]; period: Period; now: string };

const formatter = new Intl.NumberFormat("en-ID", {
  style: "currency",
  currency: "IDR",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

export function formatIdr(value: number) {
  return formatter.format(value).replace(/\u00a0/g, " ");
}
```

The same file must:

- Validate real ISO calendar dates, unique transaction ids, whole non-negative amounts, and positive budget limits.
- Select current or previous month using the supplied `now`.
- Compare elapsed current-month days with the same number of previous-month days.
- Return `hasTransactions`, four totals, comparisons, daily spending, top five categories plus `Others`, four highest-spend budgets, five newest transactions, highest-utilization alert, and one deterministic insight.
- Normalize unknown expense categories to `Others`.
- Calculate the alert from all budgets before slicing the four displayed rows.

Use the approved formulas in the design specification; no React or formatting logic belongs in this module.

- [ ] **Step 6: Run the financial tests**

Run:

```bash
npm test
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json package-lock.json postcss.config.mjs tsconfig.json next-env.d.ts src/app/globals.css src/lib/finance.ts tests/finance.test.ts
git commit -m "feat: add Next.js Tailwind foundation"
```

---

### Task 2: App Router shell, fixtures, and Overview interaction

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/lib/fixtures.ts`
- Create: `src/components/overview-dashboard.tsx`
- Create: `tests/static.test.mjs`
- Create: `public/assets/veyra-logo.svg`
- Create: `public/assets/veyra-mark.svg`

**Interfaces:**
- Consumes: `summarizeOverview()` and `formatIdr()`
- Produces: `<OverviewDashboard />`
- Client state is only `period`

- [ ] **Step 1: Import the original logo assets**

Place owner-supplied originals at:

```text
public/assets/veyra-logo.svg
public/assets/veyra-mark.svg
```

If unavailable, stop before visual preview. Do not crop or redraw the reference logo.

- [ ] **Step 2: Create relative fictional fixtures**

Create `src/lib/fixtures.ts`:

```ts
import type { Budget, Transaction } from "./finance";

function monthKey(now: string, offset: number) {
  const [year, month] = now.slice(0, 7).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(key: string, day: number) {
  return `${key}-${String(day).padStart(2, "0")}`;
}

export function createFixtureData(now: string): { transactions: Transaction[]; budgets: Budget[] } {
  const months = [monthKey(now, 0), monthKey(now, -1), monthKey(now, -2)];
  const rows = (key: string, income: number, scale: number): Transaction[] => [
    { id: `${key}-salary`, date: isoDate(key, 1), merchant: "Salary", category: "Income", amount: income, type: "income" },
    { id: `${key}-rent`, date: isoDate(key, 2), merchant: "Apartment", category: "Housing", amount: Math.round(3_200_000 * scale), type: "expense" },
    { id: `${key}-grocer`, date: isoDate(key, 5), merchant: "Farmers Market", category: "Food & Dining", amount: Math.round(1_160_000 * scale), type: "expense" },
    { id: `${key}-grab`, date: isoDate(key, 9), merchant: "Grab", category: "Transport", amount: Math.round(420_000 * scale), type: "expense" },
    { id: `${key}-pln`, date: isoDate(key, 12), merchant: "PLN", category: "Bills & Utilities", amount: Math.round(630_000 * scale), type: "expense" },
    { id: `${key}-coffee`, date: isoDate(key, 16), merchant: "Kopi Tuku", category: "Food & Dining", amount: Math.round(185_000 * scale), type: "expense" },
    { id: `${key}-shop`, date: isoDate(key, 20), merchant: "Tokopedia", category: "Shopping", amount: Math.round(920_000 * scale), type: "expense" }
  ];

  return {
    transactions: [
      ...rows(months[0], 15_600_000, 1),
      ...rows(months[1], 14_400_000, 1.08),
      ...rows(months[2], 14_000_000, 1.02)
    ],
    budgets: [
      { category: "Housing", limit: 3_800_000 },
      { category: "Food & Dining", limit: 1_700_000 },
      { category: "Transport", limit: 900_000 },
      { category: "Bills & Utilities", limit: 900_000 },
      { category: "Shopping", limit: 1_500_000 }
    ]
  };
}
```

- [ ] **Step 3: Add the server shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overview · Veyra",
  description: "Your Veyra financial overview"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import { OverviewDashboard } from "@/components/overview-dashboard";

export default function Page() {
  return <OverviewDashboard />;
}
```

- [ ] **Step 4: Build the single client boundary**

Start `src/components/overview-dashboard.tsx` with:

```tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { createFixtureData } from "@/lib/fixtures";
import { formatIdr, summarizeOverview, type Period } from "@/lib/finance";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function OverviewDashboard() {
  const [period, setPeriod] = useState<Period>("current");
  const now = useMemo(jakartaToday, []);
  const fixture = useMemo(() => createFixtureData(now), [now]);
  const summary = useMemo(
    () => summarizeOverview({ ...fixture, period, now }),
    [fixture, period, now]
  );

  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-veyra-ink">
      <label>
        Period
        <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
          <option value="current">This Month</option>
          <option value="previous">Last Month</option>
        </select>
      </label>
      <output className="sr-only" aria-live="polite">{period === "current" ? "This Month" : "Last Month"} selected.</output>
      <span>{formatIdr(summary.netCashflow)}</span>
      <Image src="/assets/veyra-logo.svg" width={124} height={32} alt="Veyra" priority />
    </div>
  );
}
```

- [ ] **Step 5: Add the static contract test**

Create `tests/static.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("uses App Router, Tailwind v4, and no unfinished dashboard destinations", async () => {
  const [page, dashboard, css, postcss] = await Promise.all([
    readFile("src/app/page.tsx", "utf8"),
    readFile("src/components/overview-dashboard.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
    readFile("postcss.config.mjs", "utf8")
  ]);
  assert.match(page, /OverviewDashboard/);
  assert.match(dashboard, /"use client"/);
  assert.match(dashboard, /This Month/);
  assert.match(dashboard, /Last Month/);
  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme/);
  assert.match(postcss, /@tailwindcss\/postcss/);
  for (const destination of ["Analytics", "Goals", "Reports", "Settings", "View All"]) {
    assert.doesNotMatch(dashboard, new RegExp(`>${destination}<`));
  }
});
```

- [ ] **Step 6: Run the checks**

Run:

```bash
npm test
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 7: Commit the App Router feature boundary**

```bash
git add src/app src/lib/fixtures.ts src/components/overview-dashboard.tsx tests/static.test.mjs public/assets/veyra-logo.svg public/assets/veyra-mark.svg
git commit -m "feat: add Veyra overview route"
```

---

### Task 3: Tailwind dashboard composition and accessible charts

**Files:**
- Modify: `src/components/overview-dashboard.tsx`
- Create: `src/components/spending-trend.tsx`
- Create: `src/components/category-breakdown.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: `OverviewSummary`
- Produces: the approved A hierarchy at 1440 × 900

- [ ] **Step 1: Add reusable Tailwind class constants inside the dashboard file**

```tsx
const panel = "min-w-0 rounded-veyra border border-veyra-line bg-white p-4";
const label = "text-xs font-medium text-slate-500";
const value = "mt-2 block text-2xl font-bold tracking-[-0.03em] text-veyra-ink";
```

Keep these local; do not create a design-system package.

- [ ] **Step 2: Replace the temporary dashboard markup**

Import `SpendingTrend` and `CategoryBreakdown`, then replace the temporary return value. Compute `cycleLabel` from `period` and `now`, and define:

```tsx
const formatCycle = (selectedPeriod: Period, today: string) => {
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const selected = new Date(Date.UTC(year, month - 1 + (selectedPeriod === "previous" ? -1 : 0), 1));
  const selectedYear = selected.getUTCFullYear();
  const selectedMonth = selected.getUTCMonth();
  const lastDay = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(selected);
  return `1–${lastDay} ${monthName} ${selectedYear}`;
};
const cycleLabel = formatCycle(period, now);
const metrics = [
  { label: "Total Spent", value: summary.totalSpent, previous: summary.comparison.totalSpent, lowerIsBetter: true },
  { label: "Total Income", value: summary.totalIncome, previous: summary.comparison.totalIncome, lowerIsBetter: false },
  { label: "Net Cashflow", value: summary.netCashflow, previous: summary.comparison.netCashflow, lowerIsBetter: false },
  { label: "Daily Average Spend", value: summary.dailyAverage, previous: summary.comparison.dailyAverage, lowerIsBetter: true }
];
const comparison = (current: number, previous: number, lowerIsBetter: boolean) => {
  if (!previous) return { text: "No comparison", className: "text-slate-500" };
  const change = Math.round(((current - previous) / previous) * 100);
  const improved = lowerIsBetter ? change <= 0 : change >= 0;
  return {
    text: `${change <= 0 ? "↓ Down" : "↑ Up"} ${Math.abs(change)}% vs previous period`,
    className: improved ? "text-veyra-success" : "text-veyra-danger"
  };
};
```

Return:

```tsx
<div className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
  <aside className="border-b border-veyra-line bg-white p-4 xl:min-h-dvh xl:border-b-0 xl:border-r xl:p-6">
    <Image src="/assets/veyra-logo.svg" width={124} height={32} alt="Veyra" priority />
    <nav aria-label="Primary" className="mt-8">
      <a href="#overview" aria-current="page" className="block rounded-lg border-l-[3px] border-veyra-cyan bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700">Overview</a>
    </nav>
    <section aria-label="Current account" className="mt-8 flex items-center gap-3 xl:fixed xl:bottom-6">
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-veyra-navy text-xs font-semibold text-white">KR</span>
      <div><strong className="block text-sm">Kaito Ren</strong><span className="text-xs text-slate-500">{cycleLabel}</span></div>
    </section>
  </aside>
  <main id="overview" className="p-4 md:p-6">
    <header className="mb-4 flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Overview</h1><p className="mt-1 text-sm text-slate-500">Here’s your financial summary.</p></div>
      <label className="text-xs text-slate-500">Period
        <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="mt-1 block rounded-lg border border-veyra-line bg-white px-3 py-2 text-sm text-veyra-ink">
          <option value="current">This Month</option>
          <option value="previous">Last Month</option>
        </select>
      </label>
    </header>
    <output className="sr-only" aria-live="polite">{period === "current" ? "This Month" : "Last Month"} selected.</output>

    <section aria-label="Financial health" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const delta = comparison(metric.value, metric.previous, metric.lowerIsBetter);
        return <article key={metric.label} className={panel}>
          <span className={label}>{metric.label}</span>
          <strong className={value}>{summary.hasTransactions ? formatIdr(metric.value) : "—"}</strong>
          <span className={`mt-2 block text-xs ${delta.className}`}>{summary.hasTransactions ? delta.text : "No activity"}</span>
        </article>;
      })}
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <article className={panel}><h2 className="mb-4 text-sm font-bold">Spending Trend</h2><SpendingTrend points={summary.dailySpend} /></article>
      <article className={panel}><h2 className="mb-4 text-sm font-bold">Spending by Category</h2><CategoryBreakdown categories={summary.categories} /></article>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-2">
      <article className={panel}>
        <h2 className="mb-4 text-sm font-bold">Budget Status</h2>
        {summary.budgets.map((budget) => <div key={budget.category} className="grid grid-cols-[1fr_auto] gap-2 border-b border-veyra-line py-2">
          <div><strong className="text-sm">{budget.category}</strong><span className="block text-xs text-slate-500">{formatIdr(budget.spent)} / {formatIdr(budget.limit)}</span></div>
          <span className="text-xs">{budget.percent}%</span>
          <progress max="100" value={Math.min(budget.percent, 100)} className="col-span-2 h-2 w-full accent-veyra-cyan">{budget.percent}%</progress>
        </div>)}
      </article>
      <article className={panel}>
        <h2 className="mb-4 text-sm font-bold">Recent Transactions</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Merchant</th><th className="p-2">Category</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>{summary.recentTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-veyra-line">
            <td className="p-2">{transaction.date}</td><td className="p-2">{transaction.merchant}</td><td className="p-2">{transaction.category}</td>
            <td className={`p-2 text-right ${transaction.type === "income" ? "text-veyra-success" : ""}`}>{transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}</td>
          </tr>)}</tbody>
        </table></div>
      </article>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-2">
      <article className={`${panel} border-t-[3px] border-t-veyra-warning`}>
        <h2 className="mb-4 text-sm font-bold">Latest Alert</h2>
        <p className="text-sm">{summary.alert && summary.alert.percent >= 80 ? `${summary.alert.category} budget is at ${summary.alert.percent}%.` : "Tracked budgets are on course."}</p>
      </article>
      <article id="veyra-insight" className={`${panel} relative min-h-40 overflow-hidden`}>
        <h2 className="mb-4 text-sm font-bold">Veyra</h2><p className="max-w-[58%] text-sm">{summary.hasTransactions ? summary.insight : "There is not enough activity to form an insight."}</p>
      </article>
    </section>
  </main>
</div>
```

- [ ] **Step 3: Add the accessible trend component**

Create `src/components/spending-trend.tsx`:

```tsx
import { formatIdr, type OverviewSummary } from "@/lib/finance";

export function SpendingTrend({ points }: { points: OverviewSummary["dailySpend"] }) {
  if (!points.length) return <p>No transactions for this month.</p>;
  const width = 600;
  const height = 220;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - (point.amount / max) * (height - 20)
  }));
  return (
    <>
      <svg className="h-[220px] w-full text-veyra-cyan" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily spending peaks at ${formatIdr(max)}.`}>
        <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="7" tabIndex={0} aria-label={`${point.date}: ${formatIdr(point.amount)}`} className="fill-white stroke-veyra-cyan stroke-[4] focus:stroke-veyra-navy" />)}
      </svg>
      <ul className="sr-only">{points.map((point) => <li key={point.date}>{point.date}: {formatIdr(point.amount)}</li>)}</ul>
    </>
  );
}
```

- [ ] **Step 4: Add the category component**

Create `src/components/category-breakdown.tsx`:

```tsx
import { formatIdr, type OverviewSummary } from "@/lib/finance";

const colors = ["#00B3FF", "#3C91E6", "#A64DFF", "#6D79D8", "#8CCFF1", "#CBD5E1"];

export function CategoryBreakdown({ categories }: { categories: OverviewSummary["categories"] }) {
  if (!categories.length) return <p>No transactions for this month.</p>;
  let cursor = 0;
  const stops = categories.map((category, index) => {
    const start = cursor;
    cursor += category.percent;
    return `${colors[index]} ${start}% ${cursor}%`;
  }).join(", ");

  return <div className="grid items-center gap-4 sm:grid-cols-[140px_1fr]">
    <div className="relative mx-auto size-36 rounded-full after:absolute after:inset-[28%] after:rounded-full after:bg-white" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label="Spending distribution by category" />
    <ul className="space-y-2">{categories.map((category, index) => <li key={category.category} className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-xs">
      <span className="size-2 rounded-full" style={{ background: colors[index] }} />
      <span>{category.category} {category.percent}%</span>
      <strong>{formatIdr(category.amount)}</strong>
    </li>)}</ul>
  </div>;
}
```

- [ ] **Step 5: Add explicit loading and error fixtures**

Inside `overview-dashboard.tsx`, keep normal rendering synchronous but add a development-only `demoState` query parameter reader supporting:

```text
?state=empty
?state=budget-error
?state=transaction-error
?state=error
```

Each state must render the approved local or complete error copy without logging data. Production default remains populated.

- [ ] **Step 6: Verify responsive and accessibility behavior**

Run:

```bash
npm test
npm run build
npm run dev
```

Expected:

- Tests pass.
- Production build succeeds.
- 1440 × 900 shows metrics, categories, and budget risk without scrolling.
- 1024px uses two metric columns and stacked lower panels.
- Below 768px remains readable in one column.
- Keyboard focus reaches the period selector and every chart point.
- Reduced-motion mode removes non-essential transitions via `motion-reduce:transition-none`.

- [ ] **Step 7: Commit the visual dashboard**

```bash
git add src/components src/app/globals.css tests/static.test.mjs
git commit -m "feat: match Veyra landing page dashboard style"
```

---

### Task 4: Generate and integrate the Veyra portrait

**Files:**
- Create: `public/assets/veyra-dashboard-portrait.png`
- Create: `public/assets/veyra-dashboard-portrait.webp`
- Create: `scripts/optimize-art.mjs`
- Create: `tests/assets.test.mjs`
- Modify: `package.json`
- Modify: `src/components/overview-dashboard.tsx`

- [ ] **Step 1: Measure the final insight-card slot**

At 1440 × 900, record its rendered width and height. Use the measured slot, not a guessed crop.

- [ ] **Step 2: Generate one transparent master with ImageGen**

Attach:

```text
/home/unmeii/.codex/attachments/c72420b8-5ccf-4d34-9102-3c0c6e13cc96/turnaround reference.png
/home/unmeii/.codex/attachments/2a81cb4f-b6cc-42ce-89d2-9f22ae687693/costume reference.png
/home/unmeii/.codex/attachments/fdc7e72f-3b39-456c-a1b0-aea3cfa343c7/telegram.png
```

Prompt:

```text
Create a production dashboard character asset of Veyra, preserving the same identity across all references: long near-black navy hair, one white front streak, cyan eyes, neutral strict expression, open structured navy coat with thin cyan trim, black high-neck inner layer. Three-quarter bust, body angled slightly left toward adjacent dashboard copy, shoulders visible, hands out of frame. Even clean studio lighting with only a restrained cyan rim. Transparent background. Crisp anime illustration suitable for a premium personal-finance dashboard. No text, props, logos, scenery, black background, glow field, extra accessories, alternate costume, smile, or dramatic pose. Keep generous transparent space around hair tips and shoulders for responsive cropping. Portrait orientation, at least 1600 × 2000.
```

Save as `public/assets/veyra-dashboard-portrait.png`.

- [ ] **Step 3: Add development-only optimization**

Run:

```bash
npm install --save-dev sharp
```

Create `scripts/optimize-art.mjs`:

```js
import sharp from "sharp";

await sharp("public/assets/veyra-dashboard-portrait.png")
  .resize({ width: 800, height: 1000, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile("public/assets/veyra-dashboard-portrait.webp");
```

Add `"assets": "node scripts/optimize-art.mjs"` to `package.json`, then run `npm run assets`.

- [ ] **Step 4: Add the asset metadata test**

Create `tests/assets.test.mjs` with `sharp().metadata()` assertions:

- PNG is at least 1600 × 2000 and has alpha.
- WebP is at most 800px wide and has alpha.
- Original logo and mark files are non-empty.

- [ ] **Step 5: Integrate with Next Image**

Use:

```tsx
<picture aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[42%] max-w-[220px]">
  <source srcSet="/assets/veyra-dashboard-portrait.webp" type="image/webp" />
  <Image src="/assets/veyra-dashboard-portrait.png" alt="" fill sizes="220px" className="object-contain object-right-bottom" />
</picture>
```

Keep copy in a separate left column. Do not mirror, stretch, recolor, or place the portrait behind metrics.

- [ ] **Step 6: Verify and commit assets**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

```bash
git add public/assets scripts/optimize-art.mjs tests/assets.test.mjs package.json package-lock.json src/components/overview-dashboard.tsx
git commit -m "feat: add Veyra dashboard portrait"
```

---

### Task 5: Final functional and visual verification

**Files:**
- Modify only files required by verified defects
- Create locally: `screenshots/veyra-overview-1440.png`

- [ ] **Step 1: Run the complete clean check**

```bash
npm install
npm test
npm run build
```

Expected: every command exits successfully.

- [ ] **Step 2: Verify the core path in the local preview**

Run `npm run dev`, then verify:

1. Cashflow direction is clear within ten seconds.
2. This Month and Last Month update every block together.
3. Cards, tooltips, rows, and labels use full IDR values.
4. Only Overview exists in navigation.
5. Empty and failure query states are honest and local.
6. No fixture payload appears in browser or server logs.

- [ ] **Step 3: Compare against the reference**

At 1440 × 900, capture the implementation and compare it together with:

```text
/home/unmeii/.codex/attachments/5d14a544-e026-4f61-8a5c-b183974d8ca0/Design 2.png
```

Correct hierarchy, spacing, type, border tone, radius, chart density, table density, and portrait crop. Repeat the comparison after fixes.

- [ ] **Step 4: Verify accessibility and responsive behavior**

- Keyboard: period selector and chart points.
- Screen reader: chart summary, table headers, status announcements.
- Color: text/status meaning remains understandable without color.
- Motion: reduced-motion preference removes non-essential transitions.
- Responsive: 1440px, 1024px, 767px, and 375px.

- [ ] **Step 5: Re-run checks and commit verified fixes**

```bash
npm test
npm run build
git add src public tests scripts package.json package-lock.json
git commit -m "fix: align Veyra overview with approved design"
```

Do not commit generated screenshots.
