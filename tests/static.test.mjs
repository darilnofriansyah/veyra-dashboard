import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(path, "utf8").catch(() => "");

test("uses App Router, Tailwind v4, and no unfinished dashboard destinations", async () => {
  const [page, dashboard, css, postcss] = await Promise.all([
    readFile("src/app/dashboard/page.tsx", "utf8"),
    readFile("src/components/overview-dashboard.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
    readFile("postcss.config.mjs", "utf8")
  ]);
  assert.match(page, /OverviewDashboard/);
  assert.match(dashboard, /"use client"/);
  assert.match(dashboard, /Current Cycle/);
  assert.match(dashboard, /Previous Cycle/);
  assert.doesNotMatch(dashboard, /This Month|Last Month/);
  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme/);
  assert.match(postcss, /@tailwindcss\/postcss/);
  for (const destination of ["Analytics", "Goals", "Reports", "Settings", "View All"]) {
    assert.doesNotMatch(dashboard, new RegExp(`>${destination}<`));
  }
});

test("loads one server-side Nexus Core overview and passes it to the client", async () => {
  const [page, dashboard, loader] = await Promise.all([
    readSource("src/app/dashboard/page.tsx"),
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/overview-loader.ts")
  ]);

  assert.match(page, /await connection\(\)/);
  assert.match(page, /function jakartaToday\(\)/);
  assert.match(page, /await loadOverview\(asOfDate\)/);
  assert.match(page, /<OverviewDashboard data=\{data\}/);
  assert.match(loader, /\/api\/veyra\/dashboard\/overview/);
  assert.match(loader, /cache:\s*"no-store"/);
  assert.match(loader, /AbortSignal\.timeout\(5_000\)/);
  assert.doesNotMatch(`${page}\n${dashboard}`, /useSearchParams|DemoState|requestedState/);
  assert.doesNotMatch(loader, /createFixtureTransactions|createFixtureBudgets/);
});

test("keeps Core API credentials and identity server-only", async () => {
  const [loader, dashboard] = await Promise.all([
    readSource("src/lib/overview-loader.ts"),
    readSource("src/components/overview-dashboard.tsx")
  ]);

  assert.match(loader, /process\.env\.CORE_API_KEY/);
  assert.match(loader, /"x-core-api-key"/);
  assert.doesNotMatch(`${loader}\n${dashboard}`, /NEXT_PUBLIC_/);
  assert.doesNotMatch(dashboard, /CORE_API_KEY|NEXUS_CORE_URL|fetch\(/);
});

test("composes the approved dashboard hierarchy", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

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
  assert.match(dashboard, /Current Cycle/);
  assert.match(dashboard, /Previous Cycle/);
  assert.doesNotMatch(dashboard, /This Month|Last Month/);
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
  assert.match(dashboard, /summary\?\.alert\s*\?\?\s*summary\?\.budgets\.find/);
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

  assert.match(dashboard, /summary\.hasTransactions \? insight : "No transactions for this period\."/);
  assert.doesNotMatch(dashboard, /No transactions for this month\./);
});

test("renders one aggregate retry state for a failed overview", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /data\.error \|\| !summary/);
  assert.match(dashboard, /Your financial summary couldn’t be loaded\./);
  assert.match(dashboard, /router\.refresh\(\)/);
  assert.doesNotMatch(dashboard, /transactionError|budgetError|guidanceError/);
});

test("names every budget progress bar", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label=\{`\$\{budget\.category\} budget used: \$\{budget\.percent\}%, \$\{statusLabel\[budget\.status\]\}`\}/);
});

test("keeps the loading header responsive and announces the pending overview", async () => {
  const loading = await readSource("src/app/dashboard/loading.tsx");

  assert.match(loading, /<header className="mb-2\.5 flex flex-wrap items-start justify-between gap-2\.5">/);
  assert.match(loading, /aria-label="Loading overview…"/);
  assert.match(loading, />Loading overview…<\/span>/);
});

test("offers keyboard users a skip link", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /href="#overview"[^>]+>Skip to overview</);
});

test("documents and supplies the server-side Nexus Core environment", async () => {
  const [example, compose] = await Promise.all([
    readSource(".env.example"),
    readSource("docker-compose.yaml")
  ]);

  for (const name of [
    "NEXUS_CORE_URL",
    "CORE_API_KEY",
    "VEYRA_TELEGRAM_USER_ID",
    "VEYRA_USER_ID"
  ]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.match(compose, new RegExp(name));
  }

  assert.match(example, /^VEYRA_TELEGRAM_USER_ID=976684739$/m);
  assert.match(example, /^VEYRA_USER_ID=1$/m);
  assert.match(compose, /http:\/\/core-api:3000/);
  assert.match(compose, /veyra-network/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_/);
});
