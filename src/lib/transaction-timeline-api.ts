import "server-only";

import {
  parseTimelinePage,
  type TimelinePage
} from "./transaction-timeline-contract.ts";
import type { TransactionFilters } from "./transaction-filters.ts";

export interface LoadTransactionTimelineInput {
  telegramUserId: string;
  asOfDate: string;
  filters: TransactionFilters;
}

export interface LoadTransactionTimelineResult {
  data: TimelinePage | null;
  error: boolean;
}

type FetchImplementation = typeof fetch;
type JsonBody = Record<string, string | number | null>;

const DEFAULT_CORE_URL = "http://core-api:3000";
const TIMEZONE = "Asia/Jakarta";
const REQUEST_TIMEOUT_MS = 5_000;

function positiveId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day >= 1 && day <= days;
}

function validMonth(value: string | null | undefined): boolean {
  return value === null || value === undefined || /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function coreUrl(): string {
  return (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
}

function queryBody(input: LoadTransactionTimelineInput): JsonBody {
  const { filters } = input;
  const body: JsonBody = {
    telegramUserId: input.telegramUserId,
    asOfDate: input.asOfDate,
    timezone: TIMEZONE,
    limit: 50
  };
  if (filters.cycle) body.cycle = filters.cycle;
  if (filters.month) body.month = filters.month;
  if (filters.category) body.category = filters.category;
  if (filters.type) body.type = filters.type;
  if (filters.search) body.merchantQuery = filters.search;
  if (filters.cursor) body.cursor = filters.cursor;
  if (filters.direction) body.direction = filters.direction;
  return body;
}

function requestOptions(body: JsonBody): RequestInit {
  const apiKey = process.env.CORE_API_KEY;
  return {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-core-api-key": apiKey } : {})
    },
    body: JSON.stringify(body)
  };
}

const queryError = (): LoadTransactionTimelineResult => ({ data: null, error: true });

export async function loadTransactionTimeline(
  input: LoadTransactionTimelineInput,
  fetchImpl: FetchImplementation = fetch
): Promise<LoadTransactionTimelineResult> {
  if (
    !input ||
    typeof input !== "object" ||
    !input.filters ||
    typeof input.filters !== "object" ||
    !positiveId(input.telegramUserId) ||
    !validDate(input.asOfDate) ||
    !validMonth(input.filters.month) ||
    (input.filters.month !== null && input.filters.month !== undefined && input.filters.cycle !== null)
  ) return queryError();

  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/transactions/timeline/query`,
      requestOptions(queryBody(input))
    );
    if (response.status !== 200) return queryError();
    return { data: parseTimelinePage(await response.json()), error: false };
  } catch {
    return queryError();
  }
}
