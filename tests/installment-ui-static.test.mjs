import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(path, "utf8").catch(() => "");

test("renders the installment flow with current-preview and date-only safeguards", async () => {
  const [dialog, actions] = await Promise.all([
    readSource("src/components/installment-dialog.tsx"),
    readSource("src/app/transactions/actions.ts")
  ]);

  assert.match(dialog, /useActionState\(\s*previewActionWithMeta/);
  assert.match(dialog, /createInstallments, previewInstallments/);
  assert.doesNotMatch(dialog, /InstallmentsAction/);
  assert.doesNotMatch(actions, /export async function (?:previewInstallmentsAction|createInstallmentsAction)/);
  assert.match(dialog, /timeZone:\s*["']Asia\/Jakarta["']/);
  assert.doesNotMatch(dialog, /toISOString\(\)/);
  assert.match(dialog, /previewGeneration/);
  assert.match(dialog, /requestKey/);
  assert.match(dialog, /responseGeneration/);
  assert.match(dialog, /responseKey/);
  assert.match(dialog, /state\.status !== "preview"/);
  assert.match(dialog, /onChange=\{invalidatePreview\}/);
  assert.match(dialog, /split\("-"\)/);
  assert.match(dialog, /Reload transaction/);
  assert.match(dialog, /Previewing installment schedule/);
  assert.match(dialog, /Preview ready/);
  assert.match(dialog, /Review the highlighted installment fields/);
  assert.match(dialog, /Principal already counted with purchase\./);
  assert.match(dialog, /Installment \{item\.sequence\}\/\{preview\.terms\.tenorMonths\}/);
});

test("keeps schedule entries read-only and planned purchase amount submitted", async () => {
  const [view, editor, page] = await Promise.all([
    readSource("src/components/transactions-page.tsx"),
    readSource("src/components/transaction-edit-dialog.tsx"),
    readSource("src/app/transactions/page.tsx")
  ]);

  assert.match(view, /kind === "installment"/);
  assert.match(view, /Add installments/);
  assert.match(view, /View purchase context/);
  assert.match(view, /originalTransactionId/);
  assert.match(view, /type:\s*"expense"/);
  assert.match(view, /search: merchant/);
  assert.match(view, /category: null/);
  assert.match(view, /budgetAmount/);
  assert.match(view, /type="month"/);
  assert.match(view, /Scheduled/);
  assert.match(view, /Due on/);
  assert.match(view, /name="month"/);
  assert.match(editor, /hasInstallmentPlan/);
  assert.match(editor, /disabled=\{pending \|\| hasInstallmentPlan\}/);
  assert.match(editor, /type="hidden" name="amount"/);
  assert.match(editor, /Reload transaction/);
  assert.match(editor, /router\.refresh\(\)/);
  assert.match(view, /hasInstallmentPlan=\{/);
  assert.match(page, /loadTransactionTimeline/);
});
