"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { InstallmentDialog } from "@/components/installment-dialog";
import { TransactionEditDialog } from "@/components/transaction-edit-dialog";
import { formatIdr } from "@/lib/finance";
import type { Pocket, Transaction } from "@/lib/transaction-contract";
import {
  transactionHref,
  type TransactionFilters
} from "@/lib/transaction-filters";
import type { TimelineEntry, TimelinePage } from "@/lib/transaction-timeline-contract";
import { transactionResultAnnouncementModel } from "@/lib/transaction-result-announcement";

interface TransactionsPageProps {
  result: { data: TimelinePage | null; error: boolean };
  pockets: Pocket[];
  pocketsUnavailable: boolean;
  filters: TransactionFilters;
  viewerName: string | null;
}

interface ActiveFilter {
  key: "cycle" | "month" | "category" | "type" | "search";
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
const scheduleMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

type TimelineTransactionEntry = Extract<TimelineEntry, { kind: "transaction" }>;
type TimelineInstallmentEntry = Extract<TimelineEntry, { kind: "installment" }>;

function dateOnlyLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return `${Number(day)} ${scheduleMonths[Number(month) - 1] ?? month} ${year}`;
}

function purchaseContextHref(
  filters: TransactionFilters,
  merchant: string
): string {
  return transactionHref(filters, {
    cycle: null,
    month: null,
    type: "expense",
    search: merchant,
    category: null,
    cursor: null,
    direction: null
  });
}

function formValue(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value ? value : null;
}

function clearPeriodSibling(
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  siblingName: "cycle" | "month"
): void {
  if (!event.currentTarget.value) return;
  const sibling = event.currentTarget.form?.elements.namedItem(siblingName);
  if (sibling instanceof HTMLInputElement || sibling instanceof HTMLSelectElement) {
    sibling.value = "";
  }
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
  if (filters.month) {
    active.push({ key: "month", label: "Month", value: filters.month });
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

function categoryOptions(data: Pick<TimelinePage, "categories"> | null, selected: string | null): string[] {
  const categories = data?.categories ?? [];
  return selected && !categories.includes(selected)
    ? [selected, ...categories]
    : categories;
}

function PreservedFilters({ filters, names }: {
  filters: TransactionFilters;
  names: Array<"cycle" | "month" | "category" | "type" | "search">;
}) {
  return <>{names.map((name) => filters[name] && (
    <input key={name} type="hidden" name={name} value={filters[name] ?? ""} />
  ))}</>;
}

function FilterControls({ data, filters }: {
  data: Pick<TimelinePage, "categories"> | null;
  filters: TransactionFilters;
}) {
  return (
    <>
      <label className="text-sm font-semibold text-slate-700">
        <span>Cycle</span>
        <select name="cycle" defaultValue={filters.cycle ?? ""} onChange={(event) => clearPeriodSibling(event, "month")} className={fieldClass}>
          <option value="">All Cycles</option>
          <option value="current">Current Cycle</option>
          <option value="previous">Previous Cycle</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Calendar month</span>
        <input name="month" type="month" defaultValue={filters.month ?? ""} onChange={(event) => clearPeriodSibling(event, "cycle")} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Category</span>
        <select name="category" defaultValue={filters.category ?? ""} className={fieldClass}>
          <option value="">All Categories</option>
          {categoryOptions(data, filters.category).map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Type</span>
        <select name="type" defaultValue={filters.type ?? ""} className={fieldClass}>
          <option value="">All Types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        <span>Merchant Search</span>
        <input name="search" type="search" autoComplete="off" defaultValue={filters.search ?? ""} maxLength={200} className={fieldClass} />
      </label>
    </>
  );
}

function ActiveFilterChips({ filters }: { filters: TransactionFilters }) {
  const filterList = activeFilters(filters);
  if (filterList.length === 0) return null;

  const clearHref = transactionHref(filters, {
    cycle: null, month: null, category: null, type: null, search: null
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
      <Link href={clearHref} className="text-sm font-semibold text-sky-700 hover:text-veyra-navy">Clear Filters</Link>
    </div>
  );
}

function FilterBar({
  data,
  filters,
  onSubmit
  }: {
  data: Pick<TimelinePage, "categories"> | null;
  filters: TransactionFilters;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section aria-label="Transaction filters" className="rounded-veyra border border-veyra-line bg-white p-4">
      <form
        key={JSON.stringify([filters.cycle, filters.month, filters.category, filters.type, filters.search])}
        onSubmit={onSubmit}
        className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1fr_1.5fr_auto] xl:items-end"
      >
        <FilterControls data={data} filters={filters} />
        <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">
          Apply Filters
        </button>
      </form>
      <div className="transaction-mobile-filters space-y-3 md:hidden">
        <form
          key={JSON.stringify([filters.cycle, filters.month, filters.category, filters.type, filters.search])}
          onSubmit={onSubmit}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
        >
          <PreservedFilters filters={filters} names={["cycle", "month", "category", "type"]} />
          <label className="min-w-0 text-sm font-semibold text-slate-700">
            <span>Merchant Search</span>
            <input name="search" type="search" autoComplete="off" defaultValue={filters.search ?? ""} maxLength={200} className={fieldClass} />
          </label>
          <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white">Search</button>
        </form>
        <details className="rounded-lg border border-veyra-line bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">Filters{activeFilters(filters).length ? ` (${activeFilters(filters).length})` : ""}</summary>
          <form
            key={JSON.stringify([filters.cycle, filters.month, filters.category, filters.type, filters.search])}
            onSubmit={onSubmit}
            className="grid gap-3 border-t border-veyra-line p-3"
          >
            <PreservedFilters filters={filters} names={["search"]} />
            <label className="text-sm font-semibold text-slate-700">
              <span>Cycle</span>
              <select name="cycle" defaultValue={filters.cycle ?? ""} onChange={(event) => clearPeriodSibling(event, "month")} className={fieldClass}>
                <option value="">All Cycles</option>
                <option value="current">Current Cycle</option>
                <option value="previous">Previous Cycle</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span>Calendar month</span>
              <input name="month" type="month" defaultValue={filters.month ?? ""} onChange={(event) => clearPeriodSibling(event, "cycle")} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span>Category</span>
              <select name="category" defaultValue={filters.category ?? ""} className={fieldClass}>
                <option value="">All Categories</option>
                {categoryOptions(data, filters.category).map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span>Type</span>
              <select name="type" defaultValue={filters.type ?? ""} className={fieldClass}>
                <option value="">All Types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <button type="submit" className="h-10 rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white">Apply Filters</button>
          </form>
        </details>
      </div>
      <ActiveFilterChips filters={filters} />
    </section>
  );
}

function TransactionRow({
  entry,
  selected,
  onEdit,
  onAddInstallments
}: {
  entry: TimelineTransactionEntry;
  selected: boolean;
  onEdit: (transaction: Transaction, button: HTMLButtonElement) => void;
  onAddInstallments: (transaction: Transaction, button: HTMLButtonElement) => void;
}) {
  const { transaction } = entry;
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
      <td className="px-4 py-3 text-slate-600">{transaction.pocketName ?? "No pocket"}</td>
      <td className="px-4 py-3 capitalize text-slate-600">{transaction.source}</td>
      <td className="px-4 py-3 capitalize text-slate-600">{transaction.type}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${transaction.type === "income" ? "text-veyra-success" : "text-veyra-ink"}`}>
        {transaction.type === "income" ? "+" : ""}{formatIdr(signedAmount)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          aria-label={`Edit transaction ${merchantLabel} on ${dateLabel}`}
          onClick={(event) => onEdit(transaction, event.currentTarget)}
          className="min-h-10 rounded-lg border border-veyra-line bg-white px-3 text-sm font-semibold text-sky-700 transition-colors hover:border-sky-200 hover:bg-sky-50 motion-reduce:transition-none"
        >
          Edit
        </button>
        {transaction.creditCard && transaction.type === "expense" && !entry.hasInstallmentPlan && (
          <button
            type="button"
            aria-label={`Add installments for ${merchantLabel} on ${dateLabel}`}
            onClick={(event) => onAddInstallments(transaction, event.currentTarget)}
            className="min-h-10 rounded-lg bg-veyra-navy px-3 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none"
          >
            Add installments
          </button>
        )}
        </div>
      </td>
    </tr>
  );
}

function InstallmentRow({ entry, filters }: { entry: TimelineInstallmentEntry; filters: TransactionFilters }) {
  const dateLabel = dateOnlyLabel(entry.dueDate);
  const statusLabel = entry.state === "due" ? `Due on ${dateLabel}` : "Scheduled";
  return (
    <tr className="bg-slate-50/60">
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        <time dateTime={entry.dueDate}>{dateLabel}</time>
      </td>
      <td className="px-4 py-3 font-semibold text-veyra-ink">
        <span className="block break-words">{entry.merchant}</span>
        <span className="mt-1 block text-xs font-semibold text-sky-700">Installment {entry.sequence}/{entry.tenorMonths}</span>
      </td>
      <td className="px-4 py-3 text-slate-600">{entry.category}</td>
      <td className="px-4 py-3 text-slate-600">{entry.pocketId ? entry.pocketId : "No pocket"}</td>
      <td className="px-4 py-3 text-slate-600">Scheduled</td>
      <td className="px-4 py-3 text-slate-600">Expense</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-veyra-ink">
        <span className="block whitespace-nowrap">{formatIdr(entry.total)}</span>
        <span className="mt-1 block text-xs font-normal text-slate-500">Principal {formatIdr(entry.principal)} · Interest {formatIdr(entry.interest)}</span>
        <span className="mt-1 block text-xs font-normal text-slate-500">{statusLabel}</span>
        {entry.interestPostingPending && <span className="mt-1 block text-xs font-semibold text-amber-700">Interest awaiting update</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <p className="mb-2 max-w-[12rem] text-left text-xs font-semibold text-slate-500">Principal already counted with purchase.</p>
        <Link
          href={purchaseContextHref(filters, entry.merchant)}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-veyra-line bg-white px-3 text-xs font-semibold text-sky-700 transition-colors hover:border-sky-200 hover:bg-sky-50 motion-reduce:transition-none"
          aria-label={`View purchase context for transaction ${entry.originalTransactionId}`}
        >
          View purchase context (ID {entry.originalTransactionId})
        </Link>
      </td>
    </tr>
  );
}

function Pagination({ data, filters }: { data: TimelinePage; filters: TransactionFilters }) {
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
  onEdit,
  onAddInstallments
}: {
  data: TimelinePage;
  filters: TransactionFilters;
  selectedTransactionId: string | null;
  onEdit: (transaction: Transaction, button: HTMLButtonElement) => void;
  onAddInstallments: (transaction: Transaction, button: HTMLButtonElement) => void;
}) {
  return <>
    <div className="transactions-desktop-table hidden md:block overflow-x-auto rounded-veyra border border-veyra-line bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <caption className="sr-only">Transactions and installment schedule</caption>
        <thead className="border-b border-veyra-line bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500"><tr>
          <th scope="col" className="px-4 py-3 font-semibold">Date</th>
          <th scope="col" className="px-4 py-3 font-semibold">Merchant</th>
          <th scope="col" className="px-4 py-3 font-semibold">Category</th>
          <th scope="col" className="px-4 py-3 font-semibold">Pocket</th>
          <th scope="col" className="px-4 py-3 font-semibold">Source</th>
          <th scope="col" className="px-4 py-3 font-semibold">Type</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold tabular-nums">Amount</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-veyra-line">{data.items.map((entry) => entry.kind === "transaction" ? (
          <TransactionRow
            key={entry.entryId}
            entry={entry}
            selected={entry.transaction.id === selectedTransactionId}
            onEdit={onEdit}
            onAddInstallments={onAddInstallments}
          />
        ) : (
          <InstallmentRow key={entry.entryId} entry={entry} filters={filters} />
        ))}</tbody>
      </table>
    </div>
    <ul className="transactions-mobile-list divide-y divide-veyra-line rounded-veyra border border-veyra-line bg-white md:hidden" aria-label="Transactions and installment schedule">
      {data.items.map((entry) => {
        if (entry.kind === "installment") {
          const dateLabel = dateOnlyLabel(entry.dueDate);
          const statusLabel = entry.state === "due" ? `Due on ${dateLabel}` : "Scheduled";
          return (
            <li key={entry.entryId} className="grid min-w-0 gap-2 bg-slate-50/60 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block break-words">{entry.merchant}</strong>
                  <span className="mt-1 block text-xs font-semibold text-sky-700">Installment {entry.sequence}/{entry.tenorMonths}</span>
                </div>
                <strong className="whitespace-nowrap text-right tabular-nums">{formatIdr(entry.total)}</strong>
              </div>
              <p className="min-w-0 break-words text-xs text-slate-600">
                <time dateTime={entry.dueDate}>{dateLabel}</time>{` · ${entry.category} · ${statusLabel}`}
              </p>
              <p className="text-xs text-slate-600">Principal {formatIdr(entry.principal)} · Interest {formatIdr(entry.interest)}</p>
              <p className="text-xs font-semibold text-slate-500">Principal already counted with purchase.</p>
              {entry.interestPostingPending && <p className="text-xs font-semibold text-amber-700">Interest awaiting update.</p>}
              <Link
                href={purchaseContextHref(filters, entry.merchant)}
                className="inline-flex min-h-10 w-fit max-w-full items-center justify-center rounded-lg border border-veyra-line bg-white px-3 text-xs font-semibold text-sky-700"
                aria-label={`View purchase context for transaction ${entry.originalTransactionId}`}
              >
                View purchase context (ID {entry.originalTransactionId})
              </Link>
            </li>
          );
        }
        const { transaction } = entry;
        const dateLabel = transactionDate.format(new Date(transaction.transactionDate));
        const merchantLabel = transaction.merchant ?? "Unknown merchant";
        const signedAmount = transaction.type === "income" ? transaction.amount : -transaction.amount;
        return (
          <li key={entry.entryId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-4">
            <strong className="min-w-0 break-words">{merchantLabel}</strong>
            <strong className={`whitespace-nowrap text-right tabular-nums ${transaction.type === "income" ? "text-veyra-success" : "text-veyra-ink"}`}>
              {transaction.type === "income" ? "+" : ""}{formatIdr(signedAmount)}
            </strong>
            <p className="min-w-0 break-words text-xs text-slate-600">
              <time dateTime={transaction.transactionDate}>{dateLabel}</time>
              {` · ${transaction.category ?? "Uncategorized"} · ${transaction.pocketName ?? "No pocket"}`}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" aria-label={`Edit transaction ${merchantLabel} on ${dateLabel}`} onClick={(event) => onEdit(transaction, event.currentTarget)} className="min-h-10 rounded-lg border border-veyra-line px-3 text-sm font-semibold text-sky-700">
                Edit
              </button>
              {transaction.creditCard && transaction.type === "expense" && !entry.hasInstallmentPlan && (
                <button type="button" aria-label={`Add installments for ${merchantLabel} on ${dateLabel}`} onClick={(event) => onAddInstallments(transaction, event.currentTarget)} className="min-h-10 rounded-lg bg-veyra-navy px-3 text-sm font-semibold text-white">
                  Add installments
                </button>
              )}
            </div>
            <span className="sr-only">{transaction.source} {transaction.type}</span>
          </li>
        );
      })}
    </ul>
    <Pagination data={data} filters={filters} />
  </>;
}

export function TransactionsPage({ result, pockets, pocketsUnavailable, filters, viewerName }: TransactionsPageProps) {
  const router = useRouter();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedInstallmentTransaction, setSelectedInstallmentTransaction] = useState<Transaction | null>(null);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const installmentReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const filterList = activeFilters(filters);

  const openEditor = useCallback((transaction: Transaction, button: HTMLButtonElement): void => {
    returnFocusRef.current = button;
    setSaveAnnouncement("");
    setSelectedTransaction(transaction);
  }, []);

  const openInstallmentDialog = useCallback((transaction: Transaction, button: HTMLButtonElement): void => {
    installmentReturnFocusRef.current = button;
    setSaveAnnouncement("");
    setSelectedInstallmentTransaction(transaction);
  }, []);

  const announceSaved = useCallback((): void => {
    setSaveAnnouncement("Transaction saved.");
  }, []);

  const closeEditor = useCallback((): void => {
    setSelectedTransaction(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const closeInstallmentDialog = useCallback((): void => {
    setSelectedInstallmentTransaction(null);
    requestAnimationFrame(() => installmentReturnFocusRef.current?.focus());
  }, []);

  const announceInstallmentsSaved = useCallback((): void => {
    setSaveAnnouncement("Installment plan saved.");
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const changes: Partial<TransactionFilters> = {
      cycle: formValue(formData, "cycle") as TransactionFilters["cycle"],
      month: formValue(formData, "month"),
      category: formValue(formData, "category"),
      type: formValue(formData, "type") as TransactionFilters["type"],
      search: formValue(formData, "search")
    };
    if (!window.dispatchEvent(new Event("veyra:before-navigation", { cancelable: true }))) return;
    router.push(transactionHref(filters, changes));
  }

  const data = result.data;
  const unavailable = result.error || !data;
  const pageCount = data?.items.length ?? 0;
  const pageCountLabel = `${pageCount} ${pageCount === 1 ? "entry" : "entries"} on this page`;
  const pageSubtotal = data?.items.reduce((sum, entry) => sum + entry.budgetAmount, 0) ?? 0;
  const selectedTransactionEntry = selectedTransaction && data?.items.find((entry) =>
    entry.kind === "transaction" && entry.transaction.id === selectedTransaction.id
  );
  const resultAnnouncement = transactionResultAnnouncementModel(result, filters);
  const clearHref = transactionHref(filters, {
    cycle: null,
    month: null,
    category: null,
    type: null,
    search: null
  });

  return (
    <AppShell
      activePage="transactions"
      viewerName={viewerName}
      accountContext="Transactions and schedules"
      mainId="transactions"
      skipLabel="Skip to transactions"
    >
      <p role="status" aria-live="polite" className="sr-only">{saveAnnouncement}</p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={resultAnnouncement.key}>{resultAnnouncement.message}</span>
      </p>
      <div className="mx-auto max-w-[1280px] space-y-4 xl:px-2 xl:py-1">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-veyra-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Transactions and schedules</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-veyra-ink">Transactions</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Review finalized income and expenses plus scheduled installment entries recorded by Veyra.</p>
          </div>
          {!unavailable && (
            <div className="text-right text-sm font-semibold text-slate-600">
              <p>{pageCountLabel}</p>
              <p className="mt-1 text-xs font-normal text-slate-500">Page subtotal: {formatIdr(pageSubtotal)}</p>
            </div>
          )}
        </header>

        <FilterBar data={data} filters={filters} onSubmit={submitFilters} />

        {unavailable ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Transactions Couldn’t Be Loaded</h2>
            <p className="mt-1 text-sm text-slate-600">Your filters are still available. Try loading the records again.</p>
            <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-lg bg-veyra-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 motion-reduce:transition-none">Retry</button>
          </section>
        ) : data.items.length === 0 ? (
          <section className="rounded-veyra border border-veyra-line bg-white p-8 text-center">
            {filterList.length > 0 ? (
              <>
                <h2 className="text-lg font-bold">No Transactions or Installment Entries Match These Filters.</h2>
                <p className="mt-1 text-sm text-slate-600">Clear the filters to return to all transactions and scheduled entries.</p>
                <Link href={clearHref} className={`${secondaryLink} mt-4`}>Clear Filters</Link>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">No Transactions or Installment Entries Yet</h2>
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
            onAddInstallments={openInstallmentDialog}
          />
        )}
      </div>
      {selectedTransaction && (
        <TransactionEditDialog
          key={selectedTransaction.id}
          transaction={selectedTransaction}
          hasInstallmentPlan={selectedTransactionEntry?.kind === "transaction" && selectedTransactionEntry.hasInstallmentPlan}
          pockets={pockets}
          pocketsUnavailable={pocketsUnavailable}
          onClose={closeEditor}
          onSaved={announceSaved}
        />
      )}
      {selectedInstallmentTransaction && (
        <InstallmentDialog
          key={selectedInstallmentTransaction.id}
          transaction={selectedInstallmentTransaction}
          onClose={closeInstallmentDialog}
          onSaved={announceInstallmentsSaved}
        />
      )}
    </AppShell>
  );
}
