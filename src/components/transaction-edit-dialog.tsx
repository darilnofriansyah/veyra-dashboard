"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editTransaction } from "@/app/transactions/actions";
import { formatIdr } from "@/lib/finance";
import { editableAmount, transactionEditIsDirty } from "@/lib/transaction-edit-form";
import type { Pocket, Transaction, TransactionEditState } from "@/lib/transaction-contract";

interface TransactionEditDialogProps {
  transaction: Transaction;
  pockets: Pocket[];
  pocketsUnavailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const initialEditState: TransactionEditState = { status: "idle" };
const inputClass = "mt-1 h-10 w-full rounded-lg border border-veyra-line bg-white px-3 text-sm text-veyra-ink";
const transactionDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta"
});

export function TransactionEditDialog({
  transaction,
  pockets,
  pocketsUnavailable,
  onClose,
  onSaved
}: TransactionEditDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const merchantRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const pocketRef = useRef<HTMLSelectElement>(null);
  const amountId = useId();
  const merchantId = useId();
  const categoryId = useId();
  const pocketId = useId();
  const titleId = useId();
  const statusId = useId();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [category, setCategory] = useState(transaction.category ?? "");
  const [selectedPocketId, setPocketId] = useState(transaction.pocketId ?? "");
  const [state, action, pending] = useActionState(editTransaction, initialEditState);

  const parsedAmount = editableAmount(amount);
  const amountDelta = parsedAmount === null ? null : parsedAmount - transaction.amount;
  const showCreditDelta = transaction.creditCard
    && amountDelta !== null
    && Number.isSafeInteger(amountDelta)
    && amountDelta !== 0;
  const dirty = transactionEditIsDirty(transaction, amount, merchant, category, selectedPocketId);
  const pocketOptions = transaction.pocketId && !pockets.some((pocket) => pocket.id === transaction.pocketId)
    ? [{ id: transaction.pocketId, name: transaction.pocketName ?? "Current pocket", amount: null, isDefault: false }, ...pockets]
    : pockets;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      onSaved();
      router.refresh();
      dialogRef.current?.close();
    }
  }, [onSaved, router, state.status]);

  useEffect(() => {
    if (state.status !== "validation") return;
    if (state.fieldErrors.amount) amountRef.current?.focus();
    else if (state.fieldErrors.merchant) merchantRef.current?.focus();
    else if (state.fieldErrors.category) categoryRef.current?.focus();
    else if (state.fieldErrors.pocketId) pocketRef.current?.focus();
  }, [state]);

  function closeDialog(): void {
    if (pending) return;
    dialogRef.current?.close();
  }

  function reloadTransaction(): void {
    router.refresh();
    closeDialog();
  }

  const amountError = state.status === "validation" ? state.fieldErrors.amount : undefined;
  const merchantError = state.status === "validation" ? state.fieldErrors.merchant : undefined;
  const categoryError = state.status === "validation" ? state.fieldErrors.category : undefined;
  const pocketError = state.status === "validation" ? state.fieldErrors.pocketId : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={state.status === "idle" ? undefined : statusId}
      aria-busy={pending}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) event.currentTarget.close();
      }}
      className="transaction-edit-dialog motion-reduce:transition-none"
    >
      <div className="flex min-h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-veyra-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Correct finalized record</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold tracking-[-0.03em] text-veyra-ink">Edit transaction</h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={pending}
            aria-label="Close transaction editor"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-veyra-line text-xl text-slate-600 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</dt>
              <dd className="mt-1 text-veyra-ink">{transactionDate.format(new Date(transaction.transactionDate))}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</dt>
              <dd className="mt-1 capitalize text-veyra-ink">{transaction.type}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</dt>
              <dd className="mt-1 capitalize text-veyra-ink">{transaction.source}</dd>
            </div>
          </dl>

          {state.status !== "idle" && (
            <div id={statusId} role="status" aria-live="polite" className="mt-4 rounded-lg border border-veyra-line bg-slate-50 p-3 text-sm text-slate-700">
              {state.status === "validation" && "Review the highlighted fields and try again."}
              {state.status === "conflict" && "This transaction changed elsewhere. Reload it before making another correction."}
              {state.status === "not_found" && "This transaction is no longer available."}
              {state.status === "unavailable" && "Changes couldn’t be saved. Your entries are still here; try again."}
            </div>
          )}

          {state.status === "conflict" && (
            <button type="button" onClick={reloadTransaction} className="mt-3 min-h-10 rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink motion-reduce:transition-none">Reload transaction</button>
          )}
          {state.status === "not_found" && (
            <button type="button" onClick={reloadTransaction} className="mt-3 min-h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">Dismiss</button>
          )}

          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input type="hidden" name="expectedUpdatedAt" value={transaction.updatedAt} />
            <input type="hidden" name="type" value={transaction.type} />

            <div>
              <label htmlFor={amountId} className="text-sm font-semibold text-slate-700">Amount (IDR)</label>
              <input
                ref={amountRef}
                id={amountId}
                name="amount"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? `${amountId}-error` : undefined}
                className={inputClass}
              />
              {amountError && <p id={`${amountId}-error`} className="mt-1 text-sm text-veyra-danger">{amountError}</p>}
              {showCreditDelta && (
                <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
                  Credit used will adjust by {amountDelta > 0 ? "+" : "−"}{formatIdr(Math.abs(amountDelta))}.
                </p>
              )}
            </div>

            <div>
              <label htmlFor={merchantId} className="text-sm font-semibold text-slate-700">Merchant</label>
              <input
                ref={merchantRef}
                id={merchantId}
                name="merchant"
                type="text"
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                required={transaction.type === "expense"}
                maxLength={200}
                aria-invalid={Boolean(merchantError)}
                aria-describedby={merchantError ? `${merchantId}-error` : undefined}
                className={inputClass}
              />
              {merchantError && <p id={`${merchantId}-error`} className="mt-1 text-sm text-veyra-danger">{merchantError}</p>}
            </div>

            <div>
              <label htmlFor={categoryId} className="text-sm font-semibold text-slate-700">Category</label>
              <input
                ref={categoryRef}
                id={categoryId}
                name="category"
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required={transaction.type === "expense"}
                maxLength={200}
                aria-invalid={Boolean(categoryError)}
                aria-describedby={categoryError ? `${categoryId}-error` : undefined}
                className={inputClass}
              />
              {categoryError && <p id={`${categoryId}-error`} className="mt-1 text-sm text-veyra-danger">{categoryError}</p>}
            </div>

            <div>
              <label htmlFor={pocketId} className="text-sm font-semibold text-slate-700">Pocket</label>
              <select
                ref={pocketRef}
                id={pocketId}
                name="pocketId"
                value={selectedPocketId}
                onChange={(event) => setPocketId(event.target.value)}
                disabled={pending || pocketsUnavailable}
                aria-invalid={Boolean(pocketError)}
                aria-describedby={pocketError ? `${pocketId}-error` : pocketsUnavailable ? `${pocketId}-note` : undefined}
                className={inputClass}
              >
                <option value="">No pocket</option>
                {pocketOptions.map((pocket) => <option key={pocket.id} value={pocket.id}>{pocket.name}</option>)}
              </select>
              {pocketsUnavailable && <input type="hidden" name="pocketId" value={selectedPocketId} />}
              {pocketError && <p id={`${pocketId}-error`} className="mt-1 text-sm text-veyra-danger">{pocketError}</p>}
              {pocketsUnavailable && <p id={`${pocketId}-note`} className="mt-1 text-sm text-slate-600">Pockets couldn’t be loaded.</p>}
            </div>

            {state.status !== "conflict" && state.status !== "not_found" && (
              <footer className="flex flex-wrap justify-end gap-2 border-t border-veyra-line pt-4">
                {!dirty && <p aria-live="polite" className="w-full text-right text-xs text-slate-500">Change amount, merchant, category, or pocket to save.</p>}
                <button type="button" onClick={closeDialog} disabled={pending} className="min-h-10 rounded-lg border border-veyra-line bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">Cancel</button>
                <button type="submit" disabled={pending || !dirty} className="min-h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </footer>
            )}
          </form>
        </div>
      </div>
    </dialog>
  );
}
