import {
  parseTransaction,
  type Transaction
} from "./transaction-contract.ts";

export interface TimelineTransactionEntry {
  kind: "transaction";
  entryId: string;
  transaction: Transaction;
  hasInstallmentPlan: boolean;
  budgetAmount: number;
}

export interface TimelineInstallmentEntry {
  kind: "installment";
  entryId: string;
  planId: string;
  originalTransactionId: string;
  sequence: number;
  tenorMonths: number;
  dueDate: string;
  merchant: string;
  category: string;
  pocketId: string | null;
  principal: number;
  interest: number;
  total: number;
  budgetAmount: number;
  scheduledBudgetAmount: number;
  state: "scheduled" | "due";
  interestPostingPending: boolean;
}

export type TimelineEntry = TimelineTransactionEntry | TimelineInstallmentEntry;

export interface TimelinePage {
  items: TimelineEntry[];
  previousCursor: string | null;
  nextCursor: string | null;
  categories: string[];
}

type JsonObject = Record<string, unknown>;

const MAX_AMOUNT = 9_999_999_999_999;
const MAX_TENOR = 120;
const MAX_CURSOR_LENGTH = 512;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as JsonObject;
}

function positiveId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function amount(value: unknown, name: string, allowZero = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_AMOUNT) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error(`Invalid ${name}`);
  return value;
}

function date(value: unknown, name: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw new Error(`Invalid ${name}`);
  const [, yearText, monthText, dayText] = DATE_PATTERN.exec(value) as RegExpExecArray;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error(`Invalid ${name}`);
  return value;
}

function nullableId(value: unknown, name: string): string | null {
  return value === null ? null : positiveId(value, name);
}

function cursor(value: unknown, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) throw new Error(`Invalid ${name}`);
  return value;
}

function parseInstallmentEntry(value: unknown): TimelineInstallmentEntry {
  const item = object(value, "timeline installment");
  const tenorMonths = item.tenorMonths;
  const sequence = item.sequence;
  if (typeof tenorMonths !== "number" || !Number.isSafeInteger(tenorMonths) || tenorMonths < 1 || tenorMonths > MAX_TENOR) throw new Error("Invalid installment tenor");
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > tenorMonths) throw new Error("Invalid installment sequence");
  const principal = amount(item.principal, "installment principal");
  const interest = amount(item.interest, "installment interest", true);
  const total = amount(item.total, "installment total");
  const budgetAmount = amount(item.budgetAmount, "installment budget amount", true);
  const scheduledBudgetAmount = amount(item.scheduledBudgetAmount, "installment scheduled budget amount", true);
  const state = item.state;
  if (state !== "scheduled" && state !== "due") throw new Error("Invalid installment state");
  if (typeof item.interestPostingPending !== "boolean") throw new Error("Invalid installment posting state");
  if (total !== principal + interest || scheduledBudgetAmount !== interest || (budgetAmount !== 0 && budgetAmount !== interest)) {
    throw new Error("Invalid installment amounts");
  }
  if (state === "scheduled" && budgetAmount !== 0) throw new Error("Invalid scheduled budget amount");
  if (state === "due" && interest > 0 && budgetAmount === 0 && item.interestPostingPending !== true) {
    throw new Error("Invalid due posting state");
  }
  if (item.interestPostingPending && (state !== "due" || interest <= 0 || budgetAmount !== 0)) {
    throw new Error("Invalid installment pending state");
  }
  const entryId = item.entryId;
  if (typeof entryId !== "string" || !/^installment:[1-9]\d*$/.test(entryId)) throw new Error("Invalid installment entry ID");
  return {
    kind: "installment",
    entryId,
    planId: positiveId(item.planId, "installment plan ID"),
    originalTransactionId: positiveId(item.originalTransactionId, "installment original transaction ID"),
    sequence,
    tenorMonths,
    dueDate: date(item.dueDate, "installment due date"),
    merchant: text(item.merchant, "installment merchant"),
    category: text(item.category, "installment category"),
    pocketId: nullableId(item.pocketId, "installment pocket ID"),
    principal,
    interest,
    total,
    budgetAmount,
    scheduledBudgetAmount,
    state,
    interestPostingPending: item.interestPostingPending
  };
}

function parseTransactionEntry(value: unknown): TimelineTransactionEntry {
  const item = object(value, "timeline transaction");
  if (item.kind !== "transaction") throw new Error("Invalid timeline transaction kind");
  const transaction = parseTransaction(item.transaction);
  if (item.entryId !== `transaction:${transaction.id}`) throw new Error("Invalid transaction entry ID");
  if (typeof item.hasInstallmentPlan !== "boolean") throw new Error("Invalid transaction plan state");
  return {
    kind: "transaction",
    entryId: item.entryId as string,
    transaction,
    hasInstallmentPlan: item.hasInstallmentPlan,
    budgetAmount: amount(item.budgetAmount, "transaction budget amount", true)
  };
}

function parseEntry(value: unknown): TimelineEntry {
  const item = object(value, "timeline entry");
  if (item.kind === "transaction") return parseTransactionEntry(item);
  if (item.kind === "installment") return parseInstallmentEntry(item);
  throw new Error("Invalid timeline entry kind");
}

export function parseTimelinePage(value: unknown): TimelinePage {
  const page = object(value, "timeline page");
  if (!Array.isArray(page.items) || !Array.isArray(page.categories)) throw new Error("Invalid timeline page");
  const categories = page.categories.map((category, index) => text(category, `timeline categories[${index}]`));
  if (new Set(categories).size !== categories.length) throw new Error("Invalid duplicate timeline categories");
  return {
    items: page.items.map(parseEntry),
    previousCursor: cursor(page.previousCursor, "timeline previous cursor"),
    nextCursor: cursor(page.nextCursor, "timeline next cursor"),
    categories
  };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
