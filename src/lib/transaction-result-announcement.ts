import type { TransactionFilters } from "./transaction-filters.ts";

interface TransactionResult {
  data: { items: readonly unknown[] } | null;
  error: boolean;
}

function navigationSignature(filters: TransactionFilters): string {
  return JSON.stringify([
    filters.cycle,
    filters.month,
    filters.category,
    filters.type,
    filters.search,
    filters.cursor,
    filters.direction
  ]);
}

function conciseValue(value: string): string {
  return value.length > 40 ? `${value.slice(0, 39)}…` : value;
}

function filterDescription(filters: TransactionFilters): {
  active: boolean;
  text: string;
} {
  const labels: string[] = [];
  if (filters.cycle) labels.push(filters.cycle === "current" ? "current cycle" : "previous cycle");
  if (filters.month) labels.push(`month ${filters.month}`);
  if (filters.category) labels.push(`category ${conciseValue(filters.category)}`);
  if (filters.type) labels.push(filters.type);
  if (filters.search) labels.push(`merchant search ${conciseValue(filters.search)}`);
  return labels.length > 0
    ? { active: true, text: `Filters: ${labels.join(", ")}.` }
    : { active: false, text: "All finalized transactions." };
}

function pageDescription(filters: TransactionFilters): string {
  if (!filters.cursor) return "First result page.";
  if (filters.direction === "previous") return "Previous result page.";
  if (filters.direction === "next") return "Next result page.";
  return "Changed result page.";
}

export function transactionResultAnnouncement(
  result: TransactionResult,
  hasActiveFilters: boolean
): string {
  if (result.error || !result.data) return "Transactions couldn’t be loaded.";

  const installmentCount = result.data.items.filter((item) => (
    typeof item === "object" && item !== null && (item as { kind?: unknown }).kind === "installment"
  )).length;
  const transactionCount = result.data.items.length - installmentCount;
  if (transactionCount > 0 && installmentCount > 0) {
    return `${transactionCount} ${transactionCount === 1 ? "transaction" : "transactions"} and ${installmentCount} installment ${installmentCount === 1 ? "entry" : "entries"} loaded on this page.`;
  }
  if (transactionCount > 0) {
    return `${transactionCount} ${transactionCount === 1 ? "transaction" : "transactions"} loaded on this page.`;
  }
  if (installmentCount > 0) {
    return `${installmentCount} installment ${installmentCount === 1 ? "entry" : "entries"} loaded on this page.`;
  }

  return hasActiveFilters
    ? "No transactions or installment entries match these filters."
    : "No transactions or installment entries yet.";
}

export function transactionResultAnnouncementModel(
  result: TransactionResult,
  filters: TransactionFilters
): { key: string; message: string } {
  const filter = filterDescription(filters);
  return {
    key: navigationSignature(filters),
    message: `${transactionResultAnnouncement(result, filter.active)} ${filter.text} ${pageDescription(filters)}`
  };
}
