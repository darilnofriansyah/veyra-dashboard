import test from "node:test";
import assert from "node:assert/strict";
import { comparison, trendLayout } from "../src/lib/dashboard-display.ts";

test("comparison direction and status use the raw delta while percentage stays rounded", () => {
  assert.deepEqual(comparison(100, 100, false), {
    text: "No change vs previous period",
    className: "text-slate-500"
  });
  assert.deepEqual(comparison(100.4, 100, true), {
    text: "↑ Up 0% vs previous period",
    className: "text-veyra-danger"
  });
});

test("trend keeps a zero peak for accessibility and zero points inside the viewbox", () => {
  const layout = trendLayout(
    [{ date: "2026-07-01", amount: 0 }],
    "2026-07-01",
    "2026-08-01",
    600,
    220
  );

  assert.equal(layout.peak, 0);
  assert.equal(layout.coordinates[0].x, layout.bounds.left);
  assert.equal(layout.coordinates[0].y, 188);
});

test("trend reserves enough left margin for full IDR axis labels", () => {
  const layout = trendLayout([
    { date: "2026-07-01", amount: 100 },
    { date: "2026-07-31", amount: 200 }
  ], "2026-07-01", "2026-08-01", 600, 180);

  assert.ok(layout.bounds.left >= 88);
  assert.equal(layout.coordinates[0].x, layout.bounds.left);
  assert.equal(layout.coordinates[1].x, 588);
  assert.equal(layout.coordinates[1].y, 12);
});

test("trend positions consecutive dates continuously across a month boundary", () => {
  const layout = trendLayout([
    { date: "2026-07-15", amount: 100 },
    { date: "2026-07-31", amount: 200 },
    { date: "2026-08-01", amount: 300 },
    { date: "2026-08-14", amount: 400 }
  ], "2026-07-15", "2026-08-15", 600, 180);

  assert.equal(layout.coordinates[0].x, layout.bounds.left);
  assert.ok(layout.coordinates[1].x < layout.coordinates[2].x);
  assert.equal(layout.coordinates[3].x, layout.bounds.right);
});
