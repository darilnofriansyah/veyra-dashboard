export type TransactionSource = "telegram" | "email" | "manual" | "import";
export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  amount: number;
  merchant: string | null;
  category: string | null;
  type: TransactionType;
  source: TransactionSource;
  transactionDate: string;
  updatedAt: string;
  creditCard: boolean;
}

export interface TransactionPageData {
  items: Transaction[];
  previousCursor: string | null;
  nextCursor: string | null;
  categories: string[];
}

export interface TransactionEditInput {
  expectedUpdatedAt: string;
  amount: number;
  merchant: string | null;
  category: string | null;
}

export type TransactionEditState =
  | { status: "idle" }
  | {
    status: "validation";
    fieldErrors: Partial<Record<"amount" | "merchant" | "category", string>>;
  }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "success"; transaction: Transaction };

export type ParsedTransactionEdit =
  | { ok: true; value: TransactionEditInput & { transactionId: string } }
  | { ok: false; state: Extract<TransactionEditState, { status: "validation" }> };

type JsonObject = Record<string, unknown>;

const MAX_TEXT_LENGTH = 200;
const MAX_CURSOR_LENGTH = 512;
const SOURCES = new Set<TransactionSource>(["telegram", "email", "manual", "import"]);
const TYPES = new Set<TransactionType>(["income", "expense"]);
const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+Z$/;

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as JsonObject;
}

function text(value: unknown, name: string, maxLength = MAX_TEXT_LENGTH): string {
  if (
    typeof value !== "string"
    || !value.trim()
    || value.length > maxLength
  ) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function nullableText(value: unknown, name: string): string | null {
  return value === null ? null : text(value, name);
}

function positiveId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function positiveRupiah(value: unknown, name: string): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value <= 0
  ) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function timestamp(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${name}`);
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) throw new Error(`Invalid ${name}`);

  const parsed = new Date(`${match[1]}.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 19) !== match[1]) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function source(value: unknown, name: string): TransactionSource {
  if (typeof value !== "string" || !SOURCES.has(value as TransactionSource)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as TransactionSource;
}

function transactionType(value: unknown, name: string): TransactionType {
  if (typeof value !== "string" || !TYPES.has(value as TransactionType)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as TransactionType;
}

function cursor(value: unknown, name: string): string | null {
  return value === null ? null : text(value, name, MAX_CURSOR_LENGTH);
}

function trimmedFormText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() || null : null;
}

function editText(
  value: string | null,
  field: "merchant" | "category",
  errors: Partial<Record<"amount" | "merchant" | "category", string>>,
  type: TransactionType
): string | null {
  if (value && value.length <= MAX_TEXT_LENGTH) return value;
  if (!value && type === "income") return null;

  errors[field] = value
    ? `${field === "merchant" ? "Merchant" : "Category"} must be 200 characters or fewer.`
    : `${field === "merchant" ? "Merchant" : "Category"} is required for expenses.`;
  return null;
}

export function parseTransaction(value: unknown): Transaction {
  const item = object(value, "transaction");
  const type = transactionType(item.type, "transaction.type");
  const merchant = nullableText(item.merchant, "transaction.merchant");
  const category = nullableText(item.category, "transaction.category");
  if (type === "expense" && (!merchant || !category)) {
    throw new Error("Invalid expense metadata");
  }
  if (typeof item.creditCard !== "boolean") {
    throw new Error("Invalid transaction.creditCard");
  }

  return {
    id: positiveId(item.id, "transaction.id"),
    amount: positiveRupiah(item.amount, "transaction.amount"),
    merchant,
    category,
    type,
    source: source(item.source, "transaction.source"),
    transactionDate: timestamp(item.transactionDate, "transaction.transactionDate"),
    updatedAt: timestamp(item.updatedAt, "transaction.updatedAt"),
    creditCard: item.creditCard
  };
}

export function parseTransactionPageData(value: unknown): TransactionPageData {
  const page = object(value, "transaction page");
  if (!Array.isArray(page.items) || !Array.isArray(page.categories)) {
    throw new Error("Invalid transaction page");
  }
  const categories = page.categories.map((category, index) =>
    text(category, `transaction page.categories[${index}]`)
  );
  if (new Set(categories).size !== categories.length) {
    throw new Error("Invalid duplicate transaction categories");
  }

  return {
    items: page.items.map(parseTransaction),
    previousCursor: cursor(page.previousCursor, "transaction page.previousCursor"),
    nextCursor: cursor(page.nextCursor, "transaction page.nextCursor"),
    categories
  };
}

export function parseTransactionEditForm(formData: FormData): ParsedTransactionEdit {
  const errors: Partial<Record<"amount" | "merchant" | "category", string>> = {};
  const transactionId = trimmedFormText(formData, "transactionId");
  const expectedUpdatedAt = trimmedFormText(formData, "expectedUpdatedAt");
  const typeValue = trimmedFormText(formData, "type");
  const amountValue = trimmedFormText(formData, "amount");
  const type = typeValue && TYPES.has(typeValue as TransactionType)
    ? typeValue as TransactionType
    : null;
  const amount = amountValue && /^[1-9]\d*$/.test(amountValue)
    ? Number(amountValue)
    : Number.NaN;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errors.amount = "Enter a positive whole-rupiah amount.";
  }

  const merchant = editText(trimmedFormText(formData, "merchant"), "merchant", errors, type ?? "expense");
  const category = editText(trimmedFormText(formData, "category"), "category", errors, type ?? "expense");

  if (
    !transactionId
    || !expectedUpdatedAt
    || !type
    || Object.keys(errors).length > 0
  ) {
    return { ok: false, state: { status: "validation", fieldErrors: errors } };
  }

  try {
    return {
      ok: true,
      value: {
        transactionId: positiveId(transactionId, "transactionId"),
        expectedUpdatedAt: timestamp(expectedUpdatedAt, "expectedUpdatedAt"),
        amount,
        merchant,
        category
      }
    };
  } catch {
    return { ok: false, state: { status: "validation", fieldErrors: errors } };
  }
}
