import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(path, "utf8").catch(() => "");

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

test("loads one request-time server date and passes settled data into the client", async () => {
  const [page, dashboard, loader, loading] = await Promise.all([
    readSource("src/app/page.tsx"),
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/overview-loader.ts"),
    readSource("src/app/loading.tsx")
  ]);

  assert.match(page, /await connection\(\)/);
  assert.match(page, /searchParams:\s*Promise/);
  assert.match(page, /await searchParams/);
  assert.match(page, /function jakartaToday\(\)/);
  assert.match(page, /<OverviewDashboard now=\{now\} data=\{data\}/);
  assert.match(loader, /Promise\.allSettled/);
  assert.match(loader, /createFixtureTransactions/);
  assert.match(loader, /createFixtureBudgets/);
  assert.match(dashboard, /router\.refresh\(\)/);
  assert.doesNotMatch(dashboard, /jakartaToday|createFixtureData|useSearchParams/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading overview/);
});

test("composes the approved dashboard hierarchy and development-only fixtures", async () => {
  const [dashboard, page, loader] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/app/page.tsx"),
    readSource("src/lib/overview-loader.ts")
  ]);

  for (const section of [
    "Financial health",
    "Spending Trend",
    "Spending by Category",
    "Budget Status",
    "Recent Transactions",
    "Latest Alert",
    "Veyra"
  ]) {
    assert.match(dashboard, new RegExp(section));
  }
  for (const state of ["empty", "budget-error", "transaction-error", "error"]) {
    assert.match(`${page}\n${loader}`, new RegExp(`"${state}"`));
  }
  assert.match(`${page}\n${loader}`, /process\.env\.NODE_ENV === "development"/);
  assert.equal([...dashboard.matchAll(/useState(?:<[^>]+>)?\(/g)].length, 1);
  assert.match(dashboard, /useState<Period>\(/);
  assert.match(dashboard, /motion-reduce:transition-none/);
});

test("uses raw budget status for rows, accessibility, and alert semantics", async () => {
  const [dashboard, finance] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/finance.ts")
  ]);

  assert.match(dashboard, /budget\.status/);
  assert.match(dashboard, /statusLabel\[budget\.status\]/);
  assert.match(dashboard, /\{budget\.percent\}% · \{statusLabel\[budget\.status\]\}/);
  assert.match(dashboard, /latestAlert\.status/);
  assert.doesNotMatch(dashboard, /summary\.alert\.percent\s*>=\s*80/);
  assert.doesNotMatch(finance, /right\.percent\s*-\s*left\.percent/);
});

test("keeps both data visualizations accessible, data-driven, and fully labeled in IDR", async () => {
  const [trend, categories] = await Promise.all([
    readSource("src/components/spending-trend.tsx"),
    readSource("src/components/category-breakdown.tsx")
  ]);

  assert.match(trend, /role="img"/);
  assert.match(trend, /tabIndex=\{0\}/);
  assert.match(trend, /aria-label/);
  assert.match(trend, /role="tooltip"/);
  assert.match(trend, /className="sr-only"/);
  assert.match(trend, /formatIdr\(peak \* ratio\)/);
  assert.doesNotMatch(trend, /compactIdr|notation:\s*"compact"/);
  assert.match(trend, /No transactions for this period\./);
  assert.match(categories, /conic-gradient/);
  assert.match(categories, /role="img"/);
  assert.match(categories, /aria-label/);
  assert.match(categories, /formatIdr\(total\)/);
  assert.doesNotMatch(categories, /compactIdr|notation:\s*"compact"/);
  assert.match(categories, /No transactions for this period\./);
});

test("keeps every requested empty state period-neutral", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /summary\.hasTransactions \? summary\.insight : "No transactions for this period\."/);
  assert.doesNotMatch(dashboard, /No transactions for this month\./);
});

test("keeps transaction-derived budgets honest when transactions fail", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /transactionError \|\| budgetError\s*\?\s*<Unavailable>/);
});

test("names every budget progress bar", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label=\{`\$\{budget\.category\} budget used: \$\{budget\.percent\}%, \$\{statusLabel\[budget\.status\]\}`\}/);
});

test("keeps the loading header responsive and announces the pending overview", async () => {
  const loading = await readSource("src/app/loading.tsx");

  assert.match(loading, /<header className="mb-2\.5 flex flex-wrap items-start justify-between gap-2\.5">/);
  assert.match(loading, /aria-label="Loading overview…"/);
  assert.match(loading, />Loading overview…<\/span>/);
});

test("offers keyboard users a skip link", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /href="#overview"[^>]+>Skip to overview</);
});
