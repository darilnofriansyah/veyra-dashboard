"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import {
  createPocketAction,
  renamePocketAction,
  updatePocketBudgetAction
} from "@/app/pockets/actions";
import type { Pocket, PocketActionState } from "@/lib/pocket-contract";

export type PocketDialogMode = "create" | "rename" | "budget";

interface PocketDialogProps {
  mode: PocketDialogMode;
  pocket?: Pocket;
  onClose: () => void;
  onSaved: () => void;
}

const initialPocketActionState: PocketActionState = { status: "idle" };
const inputClass = "mt-1 h-10 w-full rounded-lg border border-veyra-line bg-white px-3 text-sm text-veyra-ink";

function titleFor(mode: PocketDialogMode): string {
  if (mode === "create") return "Add pocket";
  if (mode === "rename") return "Rename pocket";
  return "Set monthly budget";
}

function descriptionFor(state: PocketActionState): string {
  if (state.status === "validation") return "Review the highlighted fields and try again.";
  if (state.status === "not_found") return "This pocket is no longer available. Refresh the list and try again.";
  if (state.status === "unavailable") return "Changes couldn’t be saved. Your entries are still here; try again.";
  return "";
}

export function PocketDialog({ mode, pocket, onClose, onSaved }: PocketDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const statusId = useId();
  const nameId = useId();
  const amountId = useId();
  const actionForMode = mode === "create"
    ? createPocketAction
    : mode === "rename"
      ? renamePocketAction
      : updatePocketBudgetAction;
  const [state, action, pending] = useActionState(actionForMode, initialPocketActionState);
  const nameError = state.status === "validation" ? state.fieldErrors.name : undefined;
  const amountError = state.status === "validation" ? state.fieldErrors.amount : undefined;
  const title = titleFor(mode);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      onSaved();
    }
  }, [onSaved, state.status]);

  useEffect(() => {
    if (state.status !== "validation") return;
    if (nameError) nameRef.current?.focus();
    else if (amountError) amountRef.current?.focus();
  }, [amountError, nameError, state]);

  function closeDialog(): void {
    if (pending) return;
    dialogRef.current?.close();
  }

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
      className="w-[min(100%-2rem,32rem)] rounded-veyra border border-veyra-line bg-white p-0 text-veyra-ink shadow-xl"
    >
      <form action={action} className="p-5">
        {mode !== "create" && <input type="hidden" name="pocketId" value={pocket?.id} />}
        <header className="flex items-start justify-between gap-4 border-b border-veyra-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Pocket management</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold tracking-[-0.03em]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={pending}
            aria-label={`Close ${title.toLowerCase()}`}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-veyra-line text-xl text-slate-600 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {state.status !== "idle" && state.status !== "success" && (
          <p id={statusId} className="mt-4 rounded-lg border border-veyra-line bg-slate-50 p-3 text-sm text-slate-700">
            {descriptionFor(state)}
          </p>
        )}

        <div className="mt-5 space-y-4">
          {mode !== "budget" && (
            <div>
              <label htmlFor={nameId} className="text-sm font-semibold text-slate-700">Pocket name</label>
              <input
                ref={nameRef}
                id={nameId}
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={mode === "rename" ? pocket?.name : ""}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? `${nameId}-error` : undefined}
                className={inputClass}
              />
              {nameError && <p id={`${nameId}-error`} className="mt-1 text-sm text-veyra-danger">{nameError}</p>}
            </div>
          )}

          {mode !== "rename" && (
            <div>
              <label htmlFor={amountId} className="text-sm font-semibold text-slate-700">Monthly budget (IDR)</label>
              <input
                ref={amountRef}
                id={amountId}
                name="amount"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                defaultValue={mode === "budget" && pocket?.amount !== null ? pocket?.amount : ""}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? `${amountId}-error` : undefined}
                className={inputClass}
              />
              {amountError && <p id={`${amountId}-error`} className="mt-1 text-sm text-veyra-danger">{amountError}</p>}
            </div>
          )}
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-veyra-line pt-4">
          <button type="button" onClick={closeDialog} disabled={pending} className="min-h-10 rounded-lg border border-veyra-line bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">Cancel</button>
          <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
