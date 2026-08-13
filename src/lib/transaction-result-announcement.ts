interface TransactionResult {
  data: { items: readonly unknown[] } | null;
  error: boolean;
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
