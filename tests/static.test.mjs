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

test("composes the approved dashboard hierarchy and development-only fixtures", async () => {
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
  for (const state of ["empty", "budget-error", "transaction-error", "error"]) {
    assert.match(dashboard, new RegExp(`"${state}"`));
  }
  assert.match(dashboard, /process\.env\.NODE_ENV === "development"/);
  assert.equal([...dashboard.matchAll(/useState(?:<[^>]+>)?\(/g)].length, 1);
  assert.match(dashboard, /useState<Period>\(/);
  assert.match(dashboard, /motion-reduce:transition-none/);
});

test("keeps both data visualizations accessible and data-driven", async () => {
  const [trend, categories] = await Promise.all([
    readSource("src/components/spending-trend.tsx"),
    readSource("src/components/category-breakdown.tsx")
  ]);

  assert.match(trend, /role="img"/);
  assert.match(trend, /tabIndex=\{0\}/);
  assert.match(trend, /aria-label/);
  assert.match(trend, /className="sr-only"/);
  assert.match(trend, /No transactions for this month\./);
  assert.match(categories, /conic-gradient/);
  assert.match(categories, /role="img"/);
  assert.match(categories, /aria-label/);
  assert.match(categories, /No transactions for this month\./);
});
