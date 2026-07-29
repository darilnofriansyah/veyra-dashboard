import test from "node:test";
import assert from "node:assert/strict";
import { creditUsagePercent, formatIdr } from "../src/lib/finance.ts";

test("formats whole rupiah using Indonesian grouping", () => {
  assert.match(formatIdr(8_247_300), /^IDR\s8\.247\.300$/);
});

test("keeps negative cashflow signs", () => {
  assert.match(formatIdr(-250_000), /^-IDR\s250\.000$/);
});

test("credit usage handles zero limits and preserves over-limit usage", () => {
  assert.equal(creditUsagePercent(0, 0), 0);
  assert.equal(creditUsagePercent(4_700_000, 10_000_000), 47);
  assert.equal(creditUsagePercent(11_000_000, 10_000_000), 110);
});
