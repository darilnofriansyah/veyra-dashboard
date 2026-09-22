export interface InstallmentTerms {
  tenorMonths: number;
  monthlyRatePercent: string;
  firstDueDate: string;
}

export interface InstallmentRequest extends InstallmentTerms {
  expectedUpdatedAt: string;
}

export interface ScheduleRow {
  sequence: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
}

export interface InstallmentPreview {
  originalTransactionId: string;
  originalUpdatedAt: string;
  principal: number;
  totalInterest: number;
  totalPayable: number;
  timezone: string;
  terms: InstallmentTerms;
  items: ScheduleRow[];
}

export interface InstallmentPlan extends InstallmentPreview {
  planId: string;
}

export type InstallmentField =
  | "transactionId"
  | "expectedUpdatedAt"
  | "tenorMonths"
  | "monthlyRatePercent"
  | "firstDueDate";

export type InstallmentActionStatus =
  | { status: "idle" }
  | { status: "validation"; fieldErrors: Partial<Record<InstallmentField, string>> }
  | { status: "not_found" | "conflict" | "unavailable" };

export type InstallmentPreviewActionState = InstallmentActionStatus
  | { status: "preview"; preview: InstallmentPreview; generation?: number; requestKey?: string };

export type InstallmentCreateActionState = InstallmentActionStatus
  | { status: "success"; plan: InstallmentPlan };

export type InstallmentActionState = InstallmentActionStatus
  | { status: "preview"; preview: InstallmentPreview; generation?: number; requestKey?: string }
  | { status: "success"; plan: InstallmentPlan };

type JsonObject = Record<string, unknown>;

const MAX_AMOUNT = 9_999_999_999_999;
const MAX_TENOR = 120;
const MAX_RATE_UNITS = 1_000_000;
const RATE_PATTERN = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d{6}Z$/;

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as JsonObject;
}

function positiveId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function amount(value: unknown, name: string, allowZero = false): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > MAX_AMOUNT
  ) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function date(value: unknown, name: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  const [, yearText, monthText, dayText] = DATE_PATTERN.exec(value) as RegExpExecArray;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
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

function rate(value: unknown, name: string): string {
  if (typeof value !== "string" || !RATE_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  if (units > BigInt(MAX_RATE_UNITS)) throw new Error(`Invalid ${name}`);
  const wholeUnits = units / 10_000n;
  const fractionUnits = units % 10_000n;
  return fractionUnits === 0n
    ? wholeUnits.toString()
    : `${wholeUnits}.${fractionUnits.toString().padStart(4, "0").replace(/0+$/, "")}`;
}

function timezone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new Error("Invalid timezone");
  }
  return value;
}

function terms(value: unknown): InstallmentTerms {
  const item = object(value, "terms");
  if (
    typeof item.tenorMonths !== "number" ||
    !Number.isSafeInteger(item.tenorMonths) ||
    item.tenorMonths < 1 ||
    item.tenorMonths > MAX_TENOR
  ) {
    throw new Error("Invalid terms.tenorMonths");
  }
  return {
    tenorMonths: item.tenorMonths,
    monthlyRatePercent: rate(item.monthlyRatePercent, "terms.monthlyRatePercent"),
    firstDueDate: date(item.firstDueDate, "terms.firstDueDate")
  };
}

function scheduleDate(firstDueDate: string, offset: number): string {
  const [, yearText, monthText, dayText] = DATE_PATTERN.exec(firstDueDate) as RegExpExecArray;
  const monthIndex = Number(yearText) * 12 + Number(monthText) - 1 + offset;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  if (year > 9999) throw new Error("Invalid installment due date");
  const day = Math.min(Number(dayText), daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function rows(value: unknown, installmentTerms: InstallmentTerms, principal: number, totalInterest: number, totalPayable: number): ScheduleRow[] {
  if (!Array.isArray(value) || value.length !== installmentTerms.tenorMonths) {
    throw new Error("Invalid installment schedule length");
  }

  let principalSum = 0n;
  let interestSum = 0n;
  for (const [index, rawRow] of value.entries()) {
    const item = object(rawRow, `items[${index}]`);
    const sequence = item.sequence;
    if (sequence !== index + 1) throw new Error("Invalid installment sequence");
    const row: ScheduleRow = {
      sequence,
      dueDate: date(item.dueDate, `items[${index}].dueDate`),
      principal: amount(item.principal, `items[${index}].principal`),
      interest: amount(item.interest, `items[${index}].interest`, true),
      total: amount(item.total, `items[${index}].total`)
    };
    if (row.dueDate !== scheduleDate(installmentTerms.firstDueDate, index)) {
      throw new Error("Invalid installment due date");
    }
    if (row.total !== row.principal + row.interest) {
      throw new Error("Invalid installment total");
    }
    principalSum += BigInt(row.principal);
    interestSum += BigInt(row.interest);
    if (principalSum > BigInt(MAX_AMOUNT) || interestSum > BigInt(MAX_AMOUNT)) {
      throw new Error("Invalid installment totals");
    }
  }

  if (
    principalSum !== BigInt(principal) ||
    interestSum !== BigInt(totalInterest) ||
    BigInt(totalPayable) !== principalSum + interestSum
  ) {
    throw new Error("Invalid installment totals");
  }
  return value.map((rawRow, index) => {
    const item = rawRow as JsonObject;
    return {
      sequence: index + 1,
      dueDate: item.dueDate as string,
      principal: item.principal as number,
      interest: item.interest as number,
      total: item.total as number
    };
  });
}

function parsePreview(value: unknown): InstallmentPreview {
  const item = object(value, "installment preview");
  const principal = amount(item.principal, "principal");
  const totalInterest = amount(item.totalInterest, "totalInterest", true);
  const totalPayable = amount(item.totalPayable, "totalPayable");
  const installmentTerms = terms(item.terms);
  return {
    originalTransactionId: positiveId(item.originalTransactionId, "originalTransactionId"),
    originalUpdatedAt: timestamp(item.originalUpdatedAt, "originalUpdatedAt"),
    principal,
    totalInterest,
    totalPayable,
    timezone: timezone(item.timezone),
    terms: installmentTerms,
    items: rows(item.items, installmentTerms, principal, totalInterest, totalPayable)
  };
}

export function parseInstallmentPreview(value: unknown): InstallmentPreview {
  return parsePreview(value);
}

export function parseInstallmentPlan(value: unknown): InstallmentPlan {
  const item = object(value, "installment plan");
  return {
    ...parsePreview(item),
    planId: positiveId(item.planId, "planId")
  };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
