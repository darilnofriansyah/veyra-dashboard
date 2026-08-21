import {
  parseTransaction,
  parseTransactionPageData,
  type Pocket,
  type Transaction,
  type TransactionEditInput,
  type TransactionEditState,
  type TransactionPageData
} from "./transaction-contract.ts";
import type { TransactionFilters } from "./transaction-filters.ts";

export interface LoadTransactionsInput {
  telegramUserId: string;
  asOfDate: string;
  filters: TransactionFilters;
}

export interface LoadTransactionsResult {
  data: TransactionPageData | null;
  error: boolean;
}

export interface LoadPocketsResult {
  pockets: Pocket[];
  error: boolean;
}

type UpdateTransactionResult = Exclude<TransactionEditState, { status: "idle" }>;
type FetchImplementation = typeof fetch;
type JsonBody = Record<string, string | number | null>;

const DEFAULT_CORE_URL = "http://core-api:3000";
const TIMEZONE = "Asia/Jakarta";
const REQUEST_TIMEOUT_MS = 5_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+Z$/;

function isPositiveId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return false;
  const parsed = new Date(`${match[1]}.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19) === match[1];
}

function isValidEditInput(input: TransactionEditInput): boolean {
  return isTimestamp(input.expectedUpdatedAt)
    && Number.isSafeInteger(input.amount)
    && input.amount > 0
    && isNullableText(input.merchant)
    && isNullableText(input.category)
    && (input.pocketId === null || isPositiveId(input.pocketId));
}

function isNullableText(value: string | null): boolean {
  return value === null || (Boolean(value.trim()) && value.length <= 200);
}

function coreUrl(): string {
  return (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
}

function headers(): HeadersInit {
  const apiKey = process.env.CORE_API_KEY;
  return {
    "content-type": "application/json",
    ...(apiKey ? { "x-core-api-key": apiKey } : {})
  };
}

function queryBody(input: LoadTransactionsInput): JsonBody {
  const body: JsonBody = {
    telegramUserId: input.telegramUserId,
    asOfDate: input.asOfDate,
    timezone: TIMEZONE,
    limit: 50
  };
  const { filters } = input;
  if (filters.cycle) body.cycle = filters.cycle;
  if (filters.category) body.category = filters.category;
  if (filters.type) body.type = filters.type;
  if (filters.search) body.merchantQuery = filters.search;
  if (filters.cursor) body.cursor = filters.cursor;
  if (filters.direction) body.direction = filters.direction;
  return body;
}

function updateBody(telegramUserId: string, input: TransactionEditInput): JsonBody {
  return {
    telegramUserId,
    amount: input.amount,
    merchant: input.merchant,
    category: input.category,
    pocketId: input.pocketId,
    expectedUpdatedAt: input.expectedUpdatedAt
  };
}

function requestOptions(method: "POST" | "PATCH", body: JsonBody): RequestInit {
  return {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: headers(),
    body: JSON.stringify(body)
  };
}

const queryError = (): LoadTransactionsResult => ({ data: null, error: true });
const pocketsError = (): LoadPocketsResult => ({ pockets: [], error: true });
const unavailable = (): UpdateTransactionResult => ({ status: "unavailable" });

function parsePockets(value: unknown): Pocket[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pockets");
  const response = value as Record<string, unknown>;
  if (response.status !== "ok" || !Array.isArray(response.pockets)) throw new Error("Invalid pockets");
  return response.pockets.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pocket");
    const pocket = value as Record<string, unknown>;
    const amount = pocket.amount;
    if (
      typeof pocket.id !== "string" || !isPositiveId(pocket.id)
      || typeof pocket.name !== "string" || !pocket.name.trim() || pocket.name.length > 200
      || (amount !== null && (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0))
      || typeof pocket.isDefault !== "boolean"
    ) throw new Error("Invalid pocket");
    return { id: pocket.id, name: pocket.name, amount, isDefault: pocket.isDefault };
  });
}

export async function loadTransactions(
  input: LoadTransactionsInput,
  fetchImpl: FetchImplementation = fetch
): Promise<LoadTransactionsResult> {
  if (!isPositiveId(input.telegramUserId) || !isIsoDate(input.asOfDate)) {
    return queryError();
  }

  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/transactions/query`,
      requestOptions("POST", queryBody(input))
    );
    if (response.status !== 200) return queryError();
    return { data: parseTransactionPageData(await response.json()), error: false };
  } catch {
    return queryError();
  }
}

export async function loadPockets(
  telegramUserId: string,
  fetchImpl: FetchImplementation = fetch
): Promise<LoadPocketsResult> {
  if (!isPositiveId(telegramUserId)) return pocketsError();

  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/budgets/pockets/list`,
      requestOptions("POST", { userId: telegramUserId })
    );
    if (response.status !== 200 && response.status !== 201) return pocketsError();
    return { pockets: parsePockets(await response.json()), error: false };
  } catch {
    return pocketsError();
  }
}

export async function updateTransaction(
  telegramUserId: string,
  transactionId: string,
  input: TransactionEditInput,
  fetchImpl: FetchImplementation = fetch
): Promise<UpdateTransactionResult> {
  if (!isPositiveId(telegramUserId) || !isPositiveId(transactionId) || !isValidEditInput(input)) {
    return unavailable();
  }

  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/transactions/${encodeURIComponent(transactionId)}`,
      requestOptions("PATCH", updateBody(telegramUserId, input))
    );
    if (response.status === 400) return { status: "validation", fieldErrors: {} };
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 409) return { status: "conflict" };
    if (response.status !== 200) return unavailable();
    return { status: "success", transaction: parseTransaction(await response.json()) };
  } catch {
    return unavailable();
  }
}
