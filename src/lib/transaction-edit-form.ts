import type { Transaction } from "@/lib/transaction-contract";

type EditableTransaction = Pick<Transaction, "amount" | "merchant" | "category">;

export function editableAmount(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

function normalizedText(value: string): string | null {
  return value.trim() || null;
}

export function transactionEditIsDirty(
  transaction: EditableTransaction,
  amount: string,
  merchant: string,
  category: string
): boolean {
  const parsedAmount = editableAmount(amount);
  return parsedAmount === null
    || parsedAmount !== transaction.amount
    || normalizedText(merchant) !== transaction.merchant
    || normalizedText(category) !== transaction.category;
}
