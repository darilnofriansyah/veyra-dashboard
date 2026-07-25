import test from "node:test";
import assert from "node:assert/strict";
import { formatIdr } from "../src/lib/finance.ts";

test("formats whole rupiah using Indonesian grouping", () => {
  assert.match(formatIdr(8_247_300), /^IDR\s8\.247\.300$/);
});

test("keeps negative cashflow signs", () => {
  assert.match(formatIdr(-250_000), /^-IDR\s250\.000$/);
});
