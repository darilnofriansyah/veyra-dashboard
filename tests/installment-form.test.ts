import assert from "node:assert/strict";
import test from "node:test";
import { parseInstallmentForm } from "../src/lib/installment-form.ts";

function validForm(): FormData {
  const form = new FormData();
  form.set("transactionId", "123");
  form.set("expectedUpdatedAt", "2026-09-18T03:01:00.123456Z");
  form.set("tenorMonths", "6");
  form.set("monthlyRatePercent", "1");
  form.set("firstDueDate", "2026-10-18");
  return form;
}

test("parses installment terms and accepts zero interest", () => {
  const form = validForm();
  form.set("monthlyRatePercent", "0");
  const parsed = parseInstallmentForm(form);

  assert.deepEqual(parsed, {
    ok: true,
    value: {
      transactionId: "123",
      expectedUpdatedAt: "2026-09-18T03:01:00.123456Z",
      tenorMonths: 6,
      monthlyRatePercent: "0",
      firstDueDate: "2026-10-18"
    }
  });
});

test("rejects duplicate, malformed, and calendar-invalid installment fields", () => {
  const duplicate = validForm();
  duplicate.append("tenorMonths", "12");
  assert.equal(parseInstallmentForm(duplicate).ok, false);

  const malformed = validForm();
  malformed.set("monthlyRatePercent", "100.0001");
  const malformedResult = parseInstallmentForm(malformed);
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) assert.ok(malformedResult.state.fieldErrors.monthlyRatePercent);

  const invalidDate = validForm();
  invalidDate.set("firstDueDate", "2026-02-30");
  assert.equal(parseInstallmentForm(invalidDate).ok, false);
});
