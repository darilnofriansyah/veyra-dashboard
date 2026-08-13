"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { TransactionEditDialog } from "@/components/transaction-edit-dialog";
import { formatIdr } from "@/lib/finance";
import type { Transaction, TransactionPageData } from "@/lib/transaction-contract";
import {
  transactionHref,
  type TransactionFilters
} from "@/lib/transaction-filters";
import type { LoadTransactionsResult } from "@/lib/transactions-api";
import { transactionResultAnnouncement } from "@/lib/transaction-result-announcement";

interface TransactionsPageProps {
  result: LoadTransactionsResult;
  filters: TransactionFilters;
  viewerName: string | null;
}

interface ActiveFilter {
  key: "cycle" | "category" | "type" | "search";
  label: string;
  value: string;
}

const transactionDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta"
});

const fieldClass = "mt-1 h-10 w-full rounded-lg border border-veyra-line bg-white px-3 text-sm text-veyra-ink";
const secondaryLink = "inline-flex min-h-10 items-center justify-center rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-veyra-ink motion-reduce:transition-none";

function formValue(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value ? value : null;
}

function activeFilters(filters: TransactionFilters): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  if (filters.cycle) {
    active.push({
      key: "cycle",
      label: "Cycle",
      value: filters.cycle === "current" ? "Current cycle" : "Previous cycle"
    });
  }
  if (filters.category) {
    active.push({ key: "category", label: "Category", value: filters.category });
  }
  if (filters.type) {
    active.push({
      key: "type",
      label: "Type",
      value: filters.type === "income" ? "Income" : "Expense"
    });
  }
  if (filters.search) {
    active.push({ key: "search", label: "Merchant", value: filters.search });
  }
  return active;
}

function categoryOptions(data: TransactionPageData | null, selected: string | null): string[] {
  const categories = data?.categories ?? [];
  return selected && !categories.includes(selected)
    ? [selected, ...categories]
    : categories;
}

function FilterControls({ data, filters }: {
  data: TransactionPageData | null;
  filters: TransactionFilters;
}) {
  return (
    <>
      <label className="text-sm font-semibold text-slate-700">
        <span>Cycle</span>
        <select name="cycle" defaultValue={filters.cycle ?? ""} className={fieldClass}>
          <option value="">All cycles</option>
          <option value="current">Current cycle</option>
          <option value="previous">Previous cycle</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Category</span>
        <select name="category" defaultValue={filters.category ?? ""} className={fieldClass}>
          <option value="">All categories</option>
          {categoryOptions(data, filters.category).map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Type</span>
        <select name="type" defaultValue={filters.type ?? ""} className={fieldClass}>
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Merchant search</span>
        <input name="search" type="search" autoComplete="off" defaultValue={filters.search ?? ""} maxLength={200} className={fieldClass} />
      </label>
    </>
  );
}

function ActiveFilterChips({ filters }: { filters: TransactionFilters }) {
  const filterList = activeFilters(filters);
  if (filterList.length === 0) return null;

  const clearHref = transactionHref(filters, {
    cycle: null, category: null, type: null, search: null
  });
  return (
    <div aria-label="Active filters" className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
      {filterList.map((filter) => (
        <Link
          key={filter.key}
          href={transactionHref(filters, { [filter.key]: null })}
          aria-label={`Remove ${filter.label} filter: ${filter.value}`}
          className="inline-flex min-h-8 max-w-full min-w-0 items-center break-words rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 motion-reduce:transition-none"
        >
          {filter.label}: {filter.value} <span aria-hidden="true" className="ml-2">×</span>
        </Link>
      ))}
      <Link href={clearHref} className="text-sm font-semibold text-sky-700 hover:text-veyra-navy">Clear filters</Link>
    </div>
  );
}

function FilterBar({
  data,
  filters,
  onSubmit
}: {
  data: TransactionPageData | null;
  filters: TransactionFilters;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section aria-label="Transaction filters" className="rounded-veyra border border-veyra-line bg-white p-4">
      <form
        key={JSON.stringify([filters.cycle, filters.category, filters.type, filters.search])}
        onSubmit={onSubmit}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1.5fr_auto] xl:items-end"
      >
        <FilterControls data={data} filters={filters} />
        <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">
          Apply filters
        </button>
      </form>
      <ActiveFilterChips filters={filters} />
    </section>
  );
}

function TransactionRow({
  transaction,
  selected,
  onEdit
}: {
  transaction: Transaction;
  selected: boolean;
  onEdit: (transaction: Transaction, button: HTMLButtonElement) => void;
}) {
  const signedAmount = transaction.type === "income"
    ? transaction.amount
    : -transaction.amount;
  const dateLabel = transactionDate.format(new Date(transaction.transactionDate));
  const merchantLabel = transaction.merchant ?? "Unknown merchant";
  return (
    <tr className={selected ? "bg-sky-50 shadow-[inset_4px_0_0_var(--color-veyra-cyan)]" : "hover:bg-slate-50/80"}>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        <time dateTime={transaction.transactionDate}>
          {dateLabel}
        </time>
      </td>
      <td className="px-4 py-3 font-semibold text-veyra-ink">{merchantLabel}</td>
      <td className="px-4 py-3 text-slate-600">{transaction.category ?? "Uncategorized"}</td>
      <td className="px-4 py-3 capitalize text-slate-600">{transaction.source}</td>
      <td className="px-4 py-3 capitalize text-slate-600">{transaction.type}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${transaction.type === "income" ? "text-veyra-success" : "text-veyra-ink"}`}>
        {transaction.type === "income" ? "+" : ""}{formatIdr(signedAmount)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button
          type="button"
          aria-label={`Edit transaction ${merchantLabel} on ${dateLabel}`}
          onClick={(event) => onEdit(transaction, event.currentTarget)}
          className="min-h-10 rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-sky-700 transition-colors hover:border-sky-200 hover:bg-sky-50 motion-reduce:transition-none"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function Pagination({ data, filters }: { data: TransactionPageData; filters: TransactionFilters }) {
  if (!data.previousCursor && !data.nextCursor) return null;
  return (
    <nav aria-label="Transaction pages" className="mt-4 flex justify-end gap-2">
      {data.previousCursor && <Link href={transactionHref(filters, { cursor: data.previousCursor, direction: "previous" })} className={secondaryLink}>Previous</Link>}
      {data.nextCursor && <Link href={transactionHref(filters, { cursor: data.nextCursor, direction: "next" })} className={secondaryLink}>Next</Link>}
    </nav>
  );
}

function TransactionTable({
  data,
  filters,
  selectedTransactionId,
  onEdit
}: {
  data: TransactionPageData;
  filters: TransactionFilters;
  selectedTransactionId: string | null;
  onEdit: (transaction: Transaction, button: HTMLButtonElement) => void;
}) {
  return <>
    <div className="overflow-x-auto rounded-veyra border border-veyra-line bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <caption className="sr-only">Finalized transaction records</caption>
        <thead className="border-b border-veyra-line bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500"><tr>
          <th scope="col" className="px-4 py-3 font-semibold">Date</th>
          <th scope="col" className="px-4 py-3 font-semibold">Merchant</th>
          <th scope="col" className="px-4 py-3 font-semibold">Category</th>
          <th scope="col" className="px-4 py-3 font-semibold">Source</th>
          <th scope="col" className="px-4 py-3 font-semibold">Type</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold tabular-nums">Amount</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-veyra-line">{data.items.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            selected={transaction.id === selectedTransactionId}
            onEdit={onEdit}
          />
        ))}</tbody>
      </table>
    </div>
    <Pagination data={data} filters={filters} />
  </>;
}

export function TransactionsPage({ result, filters, viewerName }: TransactionsPageProps) {
  const router = useRouter();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const filterList = activeFilters(filters);

  const openEditor = useCallback((transaction: Transaction, button: HTMLButtonElement): void => {
    returnFocusRef.current = button;
    setSaveAnnouncement("");
    setSelectedTransaction(transaction);
  }, []);

  const announceSaved = useCallback((): void => {
    setSaveAnnouncement("Transaction saved.");
  }, []);

  const closeEditor = useCallback((): void => {
    setSelectedTransaction(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const changes: Partial<TransactionFilters> = {
      cycle: formValue(formData, "cycle") as TransactionFilters["cycle"],
      category: formValue(formData, "category"),
      type: formValue(formData, "type") as TransactionFilters["type"],
      search: formValue(formData, "search")
    };
    router.push(transactionHref(filters, changes));
  }

  const data = result.data;
  const unavailable = result.error || !data;
  const pageCount = data?.items.length ?? 0;
  const pageCountLabel = `${pageCount} ${pageCount === 1 ? "transaction" : "transactions"} on this page`;
  const resultAnnouncement = transactionResultAnnouncement(result, filterList.length > 0);
  const clearHref = transactionHref(filters, {
    cycle: null,
    category: null,
    type: null,
    search: null
  });

  return (
    <AppShell
      activePage="transactions"
      viewerName={viewerName}
      accountContext="Finalized records"
      mainId="transactions"
      skipLabel="Skip to transactions"
    >
      <p role="status" aria-live="polite" className="sr-only">{saveAnnouncement}</p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{resultAnnouncement}</p>
      <div className="mx-auto max-w-[1280px] space-y-4 xl:px-2 xl:py-1">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-veyra-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Finalized records</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-veyra-ink">Transactions</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Review finalized income and expenses recorded by Veyra.</p>
          </div>
          {!unavailable && <p className="text-sm font-semibold text-slate-600">{pageCountLabel}</p>}
        </header>

        <FilterBar data={data} filters={filters} onSubmit={submitFilters} />

        {unavailable ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Transactions couldn’t be loaded</h2>
            <p className="mt-1 text-sm text-slate-600">Your filters are still available. Try loading the records again.</p>
            <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-lg bg-veyra-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">Retry</button>
          </section>
        ) : data.items.length === 0 ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            {filterList.length > 0 ? (
              <>
                <h2 className="text-lg font-bold">No finalized transactions match these filters.</h2>
                <p className="mt-1 text-sm text-slate-600">Clear the filters to return to all finalized records.</p>
                <Link href={clearHref} className={`${secondaryLink} mt-4`}>Clear filters</Link>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">No finalized transactions yet</h2>
                <p className="mt-1 text-sm text-slate-600">Transactions recorded through Telegram or email will appear here.</p>
              </>
            )}
          </section>
        ) : (
          <TransactionTable
            data={data}
            filters={filters}
            selectedTransactionId={selectedTransaction?.id ?? null}
            onEdit={openEditor}
          />
        )}
      </div>
      {selectedTransaction && (
        <TransactionEditDialog
          key={selectedTransaction.id}
          transaction={selectedTransaction}
          onClose={closeEditor}
          onSaved={announceSaved}
        />
      )}
    </AppShell>
  );
}
