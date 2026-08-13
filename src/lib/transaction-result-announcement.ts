import type { TransactionFilters } from "./transaction-filters.ts";

interface TransactionResult {
  data: { items: readonly unknown[] } | null;
  error: boolean;
}

export interface TransactionAnnouncementNavigation {
  signature: string;
  revision: number;
  hasActiveFilters: boolean;
  description: string;
}

function navigationSignature(filters: TransactionFilters): string {
  return JSON.stringify([
    filters.cycle,
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

export function nextTransactionAnnouncementNavigation(
  previous: TransactionAnnouncementNavigation | null,
  filters: TransactionFilters
): TransactionAnnouncementNavigation {
  const signature = navigationSignature(filters);
  if (previous?.signature === signature) return previous;

  const revision = (previous?.revision ?? 0) + 1;
  const filter = filterDescription(filters);
  return {
    signature,
    revision,
    hasActiveFilters: filter.active,
    description: `${filter.text} ${pageDescription(filters)} Results update ${revision}.`
  };
}

export function transactionResultAnnouncement(
  result: TransactionResult,
  hasActiveFilters: boolean
): string {
  if (result.error || !result.data) return "Transactions couldn’t be loaded.";

  const count = result.data.items.length;
  if (count > 0) {
    return `${count} ${count === 1 ? "transaction" : "transactions"} loaded on this page.`;
  }

  return hasActiveFilters
    ? "No finalized transactions match these filters."
    : "No finalized transactions yet.";
}

export function navigationAwareTransactionResultAnnouncement(
  result: TransactionResult,
  navigation: TransactionAnnouncementNavigation
): string {
  return `${transactionResultAnnouncement(result, navigation.hasActiveFilters)} ${navigation.description}`;
}
