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
