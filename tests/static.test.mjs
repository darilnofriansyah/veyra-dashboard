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
  assert.match(page, /verifySessionToken/);
  assert.match(page, /await loadOverview\(asOfDate, session\.telegramUserId\)/);
  assert.match(page, /<OverviewDashboard data=\{data\} viewerName=\{session\.name\}/);
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
  assert.doesNotMatch(loader, /VEYRA_TELEGRAM_USER_ID|VEYRA_USER_ID/);
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

test("renders one period-owned accessible credit card summary", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label="Credit card"/);
  assert.match(dashboard, /Amount to Pay/);
  assert.match(dashboard, /Credit Used/);
  assert.match(dashboard, /summary\.creditCard\.statementBalance/);
  assert.match(dashboard, /summary\.creditCard\.used/);
  assert.match(dashboard, /summary\.creditCard\.limit/);
  assert.match(dashboard, /aria-label=\{`Credit card used:/);
  assert.match(
    dashboard,
    /className="mt-1 block text-2xl[^"]*">\{formatIdr\(summary\.creditCard\.statementBalance\)\}<\/strong>/
  );
  assert.equal([...dashboard.matchAll(/aria-label="Credit card"/g)].length, 1);
  assert.ok(
    dashboard.indexOf('aria-label="Financial health"')
      < dashboard.indexOf('aria-label="Credit card"')
  );
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

test("offers only real Telegram login and safe provider errors", async () => {
  const [loginPage, actions] = await Promise.all([
    readSource("src/app/page.tsx"),
    readSource("src/app/actions.ts")
  ]);

  assert.match(loginPage, /href="\/auth\/telegram"/);
  assert.match(loginPage, /Login with Telegram/);
  assert.match(loginPage, /access_denied/);
  assert.match(loginPage, /telegram_login/);
  assert.doesNotMatch(loginPage, /Login with Email|action=\{login\}/);
  assert.doesNotMatch(actions, /DEMO_SESSION|export async function login/);
});

test("documents and supplies the production auth environment", async () => {
  const [example, compose, deploy] = await Promise.all([
    readSource(".env.example"),
    readSource("docker-compose.yaml"),
    readSource(".github/workflows/deploy.yml")
  ]);

  for (const name of [
    "APP_URL",
    "TELEGRAM_CLIENT_ID",
    "TELEGRAM_CLIENT_SECRET",
    "AUTH_SECRET",
    "NEXUS_CORE_URL",
    "CORE_API_KEY"
  ]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.match(compose, new RegExp(name));
  }

  assert.match(example, /^APP_URL=https:\/\/veyra\.darilnofriansyah\.my\.id$/m);
  assert.match(compose, /http:\/\/core-api:3000/);
  assert.match(compose, /veyra-network/);
  assert.match(deploy, /docker compose --env-file \/home\/unmeii\/apps\/\.env/);
  assert.doesNotMatch(`${example}\n${compose}`, /VEYRA_TELEGRAM_USER_ID|VEYRA_USER_ID/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_/);
});
