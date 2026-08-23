"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PocketDialog, type PocketDialogMode } from "@/components/pocket-dialog";
import { setDefaultPocketAction } from "@/app/pockets/actions";
import { formatIdr } from "@/lib/finance";
import type { Pocket, PocketActionState } from "@/lib/pocket-contract";
import type { LoadPocketsResult } from "@/lib/pockets-api";

type DialogSelection = { mode: "create" } | { mode: Exclude<PocketDialogMode, "create">; pocket: Pocket };

const initialPocketActionState: PocketActionState = { status: "idle" };
const secondaryButton = "min-h-10 rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink motion-reduce:transition-none";

function DefaultPocketButton({ pocketId, onResult }: { pocketId: string; onResult: (state: PocketActionState) => void }) {
  const [state, action, pending] = useActionState(setDefaultPocketAction, initialPocketActionState);

  useEffect(() => {
    if (state.status !== "idle") onResult(state);
  }, [onResult, state]);

  return (
    <form action={action}>
      <input type="hidden" name="pocketId" value={pocketId} />
      <button type="submit" disabled={pending} className={secondaryButton}>
        {pending ? "Updating…" : "Make Default"}
      </button>
    </form>
  );
}

function PocketList({ pockets, onOpen, onDefault }: {
  pockets: Pocket[];
  onOpen: (selection: DialogSelection, button: HTMLButtonElement) => void;
  onDefault: (state: PocketActionState) => void;
}) {
  return (
    <ul className="pocket-list divide-y divide-veyra-line overflow-hidden rounded-veyra border border-veyra-line bg-white" aria-label="Pockets">
      {pockets.map((pocket) => (
        <li key={pocket.id} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-base font-bold text-veyra-ink">{pocket.name}</h2>
              {pocket.isDefault && <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">Default</span>}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-veyra-ink">{pocket.amount === null ? "No Budget Set" : formatIdr(pocket.amount)}</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <button type="button" onClick={(event) => onOpen({ mode: "rename", pocket }, event.currentTarget)} className={secondaryButton}>Rename</button>
            <button type="button" onClick={(event) => onOpen({ mode: "budget", pocket }, event.currentTarget)} className={secondaryButton}>Set Budget</button>
            {!pocket.isDefault && <DefaultPocketButton pocketId={pocket.id} onResult={onDefault} />}
          </div>
          <details className="pocket-mobile-actions rounded-lg border border-veyra-line bg-white sm:hidden">
            <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">More Actions</summary>
            <div className="grid gap-2 border-t border-veyra-line p-2">
              <button type="button" onClick={(event) => onOpen({ mode: "rename", pocket }, event.currentTarget)} className={secondaryButton}>Rename</button>
              <button type="button" onClick={(event) => onOpen({ mode: "budget", pocket }, event.currentTarget)} className={secondaryButton}>Set Budget</button>
              {!pocket.isDefault && <DefaultPocketButton pocketId={pocket.id} onResult={onDefault} />}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function PocketsPage({ result, viewerName }: { result: LoadPocketsResult; viewerName: string | null }) {
  const router = useRouter();
  const [selection, setSelection] = useState<DialogSelection | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const openDialog = useCallback((next: DialogSelection, button: HTMLButtonElement): void => {
    returnFocusRef.current = button;
    setAnnouncement("");
    setSelection(next);
  }, []);

  const closeDialog = useCallback((): void => {
    setSelection(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const handleSaved = useCallback((): void => {
    setAnnouncement("Pocket saved.");
    router.refresh();
  }, [router]);

  const handleDefault = useCallback((state: PocketActionState): void => {
    if (state.status === "success") {
      setAnnouncement("Default pocket updated.");
      router.refresh();
    } else if (state.status === "not_found") {
      setAnnouncement("That pocket is no longer available. Refresh the list and try again.");
    } else if (state.status === "unavailable") {
      setAnnouncement("The default pocket couldn’t be changed. Try again.");
    } else if (state.status === "validation") {
      setAnnouncement("The selected pocket is invalid. Refresh the list and try again.");
    }
  }, [router]);

  const unavailable = result.error;
  const openCreate = (button: HTMLButtonElement) => openDialog({ mode: "create" }, button);

  return (
    <AppShell
      activePage="pockets"
      viewerName={viewerName}
      accountContext="Monthly budgets"
      mainId="pockets"
      skipLabel="Skip to pockets"
    >
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <div className="mx-auto max-w-[960px] space-y-4 xl:px-2 xl:py-1">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-veyra-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Monthly budgets</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-veyra-ink">Pockets</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Organize the budgets Veyra uses for your transactions.</p>
          </div>
          <button type="button" onClick={(event) => openCreate(event.currentTarget)} className="min-h-10 w-full rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 sm:w-auto motion-reduce:transition-none">Add Pocket</button>
        </header>

        {unavailable ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Pockets Couldn’t Be Loaded</h2>
            <p className="mt-1 text-sm text-slate-600">Try loading your pockets again.</p>
            <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-lg bg-veyra-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">Retry</button>
          </section>
        ) : result.pockets.length === 0 ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            <h2 className="text-lg font-bold">No Pockets Yet</h2>
            <p className="mt-1 text-sm text-slate-600">Add a pocket to set a monthly budget.</p>
            <button type="button" onClick={(event) => openCreate(event.currentTarget)} className="mt-4 w-full rounded-lg bg-veyra-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 sm:w-auto motion-reduce:transition-none">Add Pocket</button>
          </section>
        ) : (
          <PocketList pockets={result.pockets} onOpen={openDialog} onDefault={handleDefault} />
        )}
      </div>
      {selection && (
        <PocketDialog
          key={selection.mode === "create" ? "create" : `${selection.mode}-${selection.pocket.id}`}
          mode={selection.mode}
          pocket={selection.mode === "create" ? undefined : selection.pocket}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
    </AppShell>
  );
}
