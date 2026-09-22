"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createInstallments, previewInstallments } from "@/app/transactions/actions";
import { formatIdr } from "@/lib/finance";
import type { InstallmentActionState, InstallmentPreview } from "@/lib/installment-contract";
import type { Transaction } from "@/lib/transaction-contract";

interface InstallmentDialogProps {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

type PreviewState = InstallmentActionState & { generation?: number; requestKey?: string };
type CreateState = InstallmentActionState;

const initialPreviewState = { status: "idle" } as PreviewState;
const initialCreateState = { status: "idle" } as CreateState;
const inputClass = "mt-1 h-10 w-full rounded-lg border border-veyra-line bg-white px-3 text-sm text-veyra-ink";
const jakartaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const scheduleMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function jakartaDateOnly(value: string): string {
  return jakartaDate.format(new Date(value));
}

function dateOnlyLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return `${Number(day)} ${scheduleMonths[Number(month) - 1] ?? month} ${year}`;
}

function requestKey(transaction: Transaction, tenor: string, rate: string, dueDate: string): string {
  return JSON.stringify([transaction.id, transaction.updatedAt, tenor, rate, dueDate]);
}

function fieldError(state: PreviewState | CreateState, field: string): string | undefined {
  if (state.status !== "validation") return undefined;
  return state.fieldErrors[field as keyof typeof state.fieldErrors];
}

function responseGeneration(state: PreviewState): number | null {
  if (!("generation" in state) || typeof state.generation !== "number") return null;
  return state.generation;
}

function responseKey(state: PreviewState): string | null {
  if (!("requestKey" in state) || typeof state.requestKey !== "string") return null;
  return state.requestKey;
}

function responsePreview(state: PreviewState, generation: number, key: string): InstallmentPreview | null {
  if (state.status !== "preview") return null;
  if (responseGeneration(state) !== generation || responseKey(state) !== key) return null;
  return state.preview;
}

async function previewActionWithMeta(
  previousState: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const generation = Number(formData.get("previewGeneration"));
  const requestKey = String(formData.get("requestKey") ?? "");
  const state = await previewInstallments(previousState, formData);
  return { ...state, generation, requestKey };
}

export function InstallmentDialog({ transaction, onClose, onSaved }: InstallmentDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const monthsRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();
  const statusId = useId();
  const monthsId = useId();
  const rateId = useId();
  const dateId = useId();
  const [tenor, setTenor] = useState("6");
  const [rate, setRate] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(() => jakartaDateOnly(transaction.transactionDate));
  const [generation, setGeneration] = useState(0);
  const [previewState, previewAction, previewPending] = useActionState(
    previewActionWithMeta,
    initialPreviewState
  );
  const [createState, createAction, createPending] = useActionState(
    createInstallments,
    initialCreateState
  );

  const currentRequestKey = requestKey(transaction, tenor, rate, firstDueDate);
  const preview = responsePreview(previewState, generation, currentRequestKey);
  const pending = previewPending || createPending;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    monthsRef.current?.focus();
  }, []);

  useEffect(() => {
    if (createState.status !== "success") return;
    onSaved();
    closeDialog(true);
    router.refresh();
  }, [createState.status, onSaved, router]);

  const previewError = previewState.status === "unavailable"
    ? "The installment preview couldn’t be loaded. Your entries are still here; try again."
    : previewState.status === "not_found"
      ? "This transaction is no longer available."
      : previewState.status === "conflict"
        ? "This transaction changed elsewhere. Reload it before creating installments."
        : null;
  const createError = createState.status === "unavailable"
    ? "The installment plan couldn’t be saved. Your entries are still here; try again."
    : createState.status === "not_found"
      ? "This transaction is no longer available."
      : createState.status === "conflict"
        ? "This transaction changed elsewhere. Reload it before creating installments."
        : null;
  const monthsError = fieldError(previewState, "tenorMonths") ?? fieldError(createState, "tenorMonths");
  const rateError = fieldError(previewState, "monthlyRatePercent") ?? fieldError(createState, "monthlyRatePercent");
  const dateError = fieldError(previewState, "firstDueDate") ?? fieldError(createState, "firstDueDate");
  const conflict = previewState.status === "conflict" || createState.status === "conflict";
  const createBlocked = createState.status === "conflict" || createState.status === "not_found";

  let statusMessage = "";
  if (createPending) statusMessage = "Saving installment plan…";
  else if (previewPending) statusMessage = "Previewing installment schedule…";
  else if (createState.status === "validation") statusMessage = "Review the highlighted installment fields and try again.";
  else if (previewState.status === "validation") statusMessage = "Review the highlighted installment fields and preview again.";
  else if (createError) statusMessage = createError;
  else if (previewError) statusMessage = previewError;
  else if (previewState.status === "preview" && preview) statusMessage = "Preview ready. Review the schedule before saving.";
  else if (previewState.status === "preview") statusMessage = "Preview is out of date. Preview the schedule again before saving.";

  useEffect(() => {
    if (previewState.status !== "validation" && createState.status !== "validation") return;
    if (monthsError) monthsRef.current?.focus();
    else if (rateError) document.getElementById(rateId)?.focus();
    else if (dateError) document.getElementById(dateId)?.focus();
  }, [createState.status, dateError, monthsError, previewState.status, rateError, rateId, dateId]);

  function invalidatePreview(): void {
    setGeneration((value) => value + 1);
  }

  function closeDialog(force = false): boolean {
    if (pending && !force) return false;
    dialogRef.current?.close();
    return true;
  }

  function reloadTransaction(): void {
    if (closeDialog(true)) router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={dialogTitleId}
      aria-describedby={statusMessage ? statusId : undefined}
      aria-busy={pending}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      className="transaction-edit-dialog motion-reduce:transition-none"
    >
      <div className="flex min-h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-veyra-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Credit-card purchase</p>
            <h2 id={dialogTitleId} className="mt-1 text-xl font-bold tracking-[-0.03em] text-veyra-ink">Add installments</h2>
          </div>
          <button
            type="button"
            onClick={() => closeDialog()}
            disabled={pending}
            aria-label="Close installment dialog"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-veyra-line text-xl text-slate-600 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purchase</dt>
              <dd className="mt-1 break-words font-semibold text-veyra-ink">{transaction.merchant ?? "Unknown merchant"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Principal</dt>
              <dd className="mt-1 text-veyra-ink">{formatIdr(transaction.amount)}</dd>
            </div>
          </dl>

          {statusMessage && (
            <div id={statusId} role="status" aria-live="polite" aria-atomic="true" className="mt-4 rounded-lg border border-veyra-line bg-slate-50 p-3 text-sm text-slate-700">
              {statusMessage}
            </div>
          )}

          {conflict && (
            <button type="button" onClick={reloadTransaction} className="mt-3 min-h-10 rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink motion-reduce:transition-none">
              Reload transaction
            </button>
          )}

          <form
            action={previewAction}
            onChange={invalidatePreview}
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input type="hidden" name="expectedUpdatedAt" value={transaction.updatedAt} />
            <input type="hidden" name="previewGeneration" value={generation} />
            <input type="hidden" name="requestKey" value={currentRequestKey} />

            <div>
              <label htmlFor={monthsId} className="text-sm font-semibold text-slate-700">Number of months</label>
              <input
                ref={monthsRef}
                id={monthsId}
                name="tenorMonths"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                step="1"
                required
                value={tenor}
                onChange={(event) => setTenor(event.target.value)}
                aria-invalid={Boolean(monthsError)}
                aria-describedby={monthsError ? `${monthsId}-error` : undefined}
                className={inputClass}
              />
              {monthsError && <p id={`${monthsId}-error`} className="mt-1 text-sm text-veyra-danger">{monthsError}</p>}
            </div>

            <div>
              <label htmlFor={rateId} className="text-sm font-semibold text-slate-700">Monthly interest rate (% per month, flat)</label>
              <input
                id={rateId}
                name="monthlyRatePercent"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.0001"
                required
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                aria-invalid={Boolean(rateError)}
                aria-describedby={rateError ? `${rateId}-error` : undefined}
                className={inputClass}
              />
              {rateError && <p id={`${rateId}-error`} className="mt-1 text-sm text-veyra-danger">{rateError}</p>}
            </div>

            <div>
              <label htmlFor={dateId} className="text-sm font-semibold text-slate-700">First due date</label>
              <input
                id={dateId}
                name="firstDueDate"
                type="date"
                required
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? `${dateId}-error` : undefined}
                className={inputClass}
              />
              {dateError && <p id={`${dateId}-error`} className="mt-1 text-sm text-veyra-danger">{dateError}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-veyra-line pt-4">
              <button
                type="submit"
                disabled={pending}
                className="min-h-10 rounded-lg border border-veyra-line bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
              >
                {previewPending ? "Previewing…" : "Preview schedule"}
              </button>
              <button
                type="submit"
                formAction={createAction}
                disabled={pending || !preview || createBlocked}
                className="min-h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
              >
                {createPending ? "Saving…" : "Save installments"}
              </button>
            </div>
          </form>

          {preview && <PreviewSchedule preview={preview} />}
        </div>
      </div>
    </dialog>
  );
}

function PreviewSchedule({ preview }: { preview: InstallmentPreview }) {
  return (
    <section aria-label="Installment preview" className="mt-5 space-y-3">
      <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
        <p className="font-semibold">{preview.terms.tenorMonths} installments · {formatIdr(preview.totalPayable)} total payable</p>
        <p className="mt-1">Total interest: {formatIdr(preview.totalInterest)}. Principal is counted with the original purchase.</p>
      </div>
      <ol className="divide-y divide-veyra-line rounded-lg border border-veyra-line bg-white">
        {preview.items.map((item) => (
          <li key={item.sequence} className="space-y-1 p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>Installment {item.sequence}/{preview.terms.tenorMonths}</strong>
              <strong className="tabular-nums">{formatIdr(item.total)}</strong>
            </div>
            <p className="text-slate-600">Due {dateOnlyLabel(item.dueDate)}</p>
            <p className="text-slate-600">Principal {formatIdr(item.principal)} · Interest {formatIdr(item.interest)}</p>
            <p className="text-xs font-semibold text-slate-500">Principal already counted with purchase.</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
