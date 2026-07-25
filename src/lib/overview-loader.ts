import type {
  BudgetStatus,
  BudgetSummary,
  OverviewResponse,
  PeriodOverview,
  Totals
} from "./finance.ts";

export type OverviewLoaderResult = {
  data: OverviewResponse | null;
  error: boolean;
};

type JsonObject = Record<string, unknown>;
type FetchImplementation = typeof fetch;

const DEFAULT_CORE_URL = "http://core-api:3000";
const DEFAULT_TELEGRAM_USER_ID = "976684739";
const DEFAULT_USER_ID = 1;
const TIMEZONE = "Asia/Jakarta";
const BUDGET_STATUSES = new Set<BudgetStatus>(["on-track", "warning", "over"]);
const PERIOD_LABELS = new Set(["current_cycle", "previous_cycle"]);

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as JsonObject;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function rupiah(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return number;
}

function signedRupiah(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${name}`);
  return number;
}

function positiveRupiah(value: unknown, name: string): number {
  const number = rupiah(value, name);
  if (number === 0) throw new Error(`Invalid ${name}`);
  return number;
}

function nonNegativeNumber(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (number < 0) throw new Error(`Invalid ${name}`);
  return number;
}

function count(value: unknown, name: string): number {
  const number = rupiah(value, name);
  return number;
}

function nullableText(value: unknown, name: string): string | null {
  return value === null ? null : text(value, name);
}

function isoDate(value: unknown, name: string): string {
  const date = text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ${name}`);
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ${name}`);
  }
  return date;
}

function list<T>(
  value: unknown,
  name: string,
  parse: (item: unknown, index: number) => T
): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value.map(parse);
}

function parseTotals(value: unknown, name: string): Totals {
  const item = object(value, name);
  return {
    income: rupiah(item.income, `${name}.income`),
    spent: rupiah(item.spent, `${name}.spent`),
    netCashflow: signedRupiah(item.netCashflow, `${name}.netCashflow`),
    dailyAverage: rupiah(item.dailyAverage, `${name}.dailyAverage`)
  };
}

function parseBudget(value: unknown, name: string): BudgetSummary {
  const item = object(value, name);
  const status = text(item.status, `${name}.status`) as BudgetStatus;
  if (!BUDGET_STATUSES.has(status)) throw new Error(`Invalid ${name}.status`);
  return {
    category: text(item.category, `${name}.category`),
    limit: positiveRupiah(item.limit, `${name}.limit`),
    spent: rupiah(item.spent, `${name}.spent`),
    percent: nonNegativeNumber(item.percent, `${name}.percent`),
    status
  };
}

function parsePeriodOverview(value: unknown, name: string): PeriodOverview {
  const item = object(value, name);
  const periodValue = object(item.period, `${name}.period`);
  const label = text(
    periodValue.label,
    `${name}.period.label`
  ) as PeriodOverview["period"]["label"];
  if (!PERIOD_LABELS.has(label)) {
    throw new Error(`Invalid ${name}.period.label`);
  }
  const start = isoDate(periodValue.start, `${name}.period.start`);
  const end = isoDate(periodValue.end, `${name}.period.end`);
  if (start >= end) throw new Error(`Invalid ${name}.period`);
  if (typeof item.hasTransactions !== "boolean") {
    throw new Error(`Invalid ${name}.hasTransactions`);
  }

  return {
    period: { label, start, end },
    hasTransactions: item.hasTransactions,
    totals: parseTotals(item.totals, `${name}.totals`),
    comparison: parseTotals(item.comparison, `${name}.comparison`),
    dailySpend: list(item.dailySpend, `${name}.dailySpend`, (value, index) => {
      const day = object(value, `${name}.dailySpend[${index}]`);
      return {
        date: isoDate(day.date, `${name}.dailySpend[${index}].date`),
        amount: rupiah(day.amount, `${name}.dailySpend[${index}].amount`)
      };
    }),
    categories: list(item.categories, `${name}.categories`, (value, index) => {
      const category = object(value, `${name}.categories[${index}]`);
      return {
        category: text(category.category, `${name}.categories[${index}].category`),
        amount: rupiah(category.amount, `${name}.categories[${index}].amount`),
        percent: nonNegativeNumber(
          category.percent,
          `${name}.categories[${index}].percent`
        ),
        transactionCount: count(
          category.transactionCount,
          `${name}.categories[${index}].transactionCount`
        )
      };
    }),
    budgets: list(item.budgets, `${name}.budgets`, (value, index) =>
      parseBudget(value, `${name}.budgets[${index}]`)
    ),
    recentTransactions: list(
      item.recentTransactions,
      `${name}.recentTransactions`,
      (value, index) => {
        const transaction = object(
          value,
          `${name}.recentTransactions[${index}]`
        );
        const type = text(
          transaction.type,
          `${name}.recentTransactions[${index}].type`
        );
        if (type !== "income" && type !== "expense") {
          throw new Error(`Invalid ${name}.recentTransactions[${index}].type`);
        }
        return {
          id: text(transaction.id, `${name}.recentTransactions[${index}].id`),
          date: isoDate(
            transaction.date,
            `${name}.recentTransactions[${index}].date`
          ),
          merchant: nullableText(
            transaction.merchant,
            `${name}.recentTransactions[${index}].merchant`
          ),
          category: nullableText(
            transaction.category,
            `${name}.recentTransactions[${index}].category`
          ),
          amount: rupiah(
            transaction.amount,
            `${name}.recentTransactions[${index}].amount`
          ),
          type
        };
      }
    ),
    alert: item.alert === undefined || item.alert === null
      ? null
      : parseBudget(item.alert, `${name}.alert`)
  };
}

function parseOverviewResponse(value: unknown): OverviewResponse {
  const response = object(value, "overview response");
  const user = object(response.user, "user");
  const current = parsePeriodOverview(response.current, "current");
  const previous = parsePeriodOverview(response.previous, "previous");
  if (
    current.period.label !== "current_cycle"
    || previous.period.label !== "previous_cycle"
  ) {
    throw new Error("Invalid overview period labels");
  }
  return {
    user: {
      id: text(user.id, "user.id"),
      telegramUserId: text(user.telegramUserId, "user.telegramUserId")
    },
    current,
    previous
  };
}

const errorResult = (): OverviewLoaderResult => ({ data: null, error: true });

export async function loadOverview(
  asOfDate: string,
  fetchImpl: FetchImplementation = fetch
): Promise<OverviewLoaderResult> {
  try {
    isoDate(asOfDate, "asOfDate");
    const baseUrl = (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
    const apiKey = process.env.CORE_API_KEY;
    const userId = Number(process.env.VEYRA_USER_ID ?? DEFAULT_USER_ID);
    if (!Number.isSafeInteger(userId) || userId <= 0) return errorResult();
    const response = await fetchImpl(`${baseUrl}/api/veyra/dashboard/overview`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-core-api-key": apiKey } : {})
      },
      body: JSON.stringify({
        telegramUserId: process.env.VEYRA_TELEGRAM_USER_ID ?? DEFAULT_TELEGRAM_USER_ID,
        userId,
        asOfDate,
        timezone: TIMEZONE
      })
    });

    if (!response.ok) return errorResult();
    return { data: parseOverviewResponse(await response.json()), error: false };
  } catch {
    return errorResult();
  }
}
