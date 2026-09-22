import assert from "node:assert/strict";
import test from "node:test";
import {
  parseInstallmentPlan,
  parseInstallmentPreview
} from "../src/lib/installment-contract.ts";

const preview = {
  originalTransactionId: "123",
  originalUpdatedAt: "2026-09-18T03:01:00.123456Z",
  principal: 6_000_000,
  totalInterest: 360_000,
  totalPayable: 6_360_000,
  timezone: "Asia/Jakarta",
  terms: {
    tenorMonths: 6,
    monthlyRatePercent: "1",
    firstDueDate: "2026-10-18"
  },
  items: ["2026-10-18", "2026-11-18", "2026-12-18", "2027-01-18", "2027-02-18", "2027-03-18"].map((dueDate, index) => ({
    sequence: index + 1,
    dueDate,
    principal: 1_000_000,
    interest: 60_000,
    total: 1_060_000
  }))
};

test("accepts a zero-rate installment preview", () => {
  const parsed = parseInstallmentPreview({
    ...preview,
    totalInterest: 0,
    totalPayable: 6_000_000,
    terms: { ...preview.terms, monthlyRatePercent: "0" },
    items: preview.items.map((item) => ({ ...item, interest: 0, total: item.principal }))
  });

  assert.equal(parsed.terms.monthlyRatePercent, "0");
  assert.equal(parsed.items[0]?.interest, 0);
});

test("requires schedule fields and rejects unsafe money", () => {
  assert.throws(() => parseInstallmentPreview({ ...preview, items: preview.items.slice(0, 1) }));
  assert.throws(() => parseInstallmentPreview({
    ...preview,
    items: preview.items.map((item, index) => index === 1 ? { ...item, sequence: 1 } : item)
  }));
  assert.throws(() => parseInstallmentPreview({ ...preview, totalPayable: undefined }));
  assert.throws(() => parseInstallmentPreview({ ...preview, principal: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => parseInstallmentPreview({ ...preview, items: [{ ...preview.items[0], total: -1 }] }));
});

test("parses a plan only when its plan ID is valid", () => {
  assert.equal(parseInstallmentPlan({ ...preview, planId: "7" }).planId, "7");
  assert.throws(() => parseInstallmentPlan({ ...preview, planId: "0" }));
});
