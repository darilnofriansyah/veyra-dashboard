import "server-only";

import {
  parseInstallmentPlan,
  parseInstallmentPreview,
  type InstallmentPlan,
  type InstallmentPreview,
  type InstallmentRequest
} from "./installment-contract.ts";

export type InstallmentApiResult<T> =
  | { status: "success"; value: T }
  | { status: "validation"; fieldErrors: Record<string, string> }
  | { status: "not_found" }
  | { status: "conflict" }
  | { status: "unavailable" };

export type PreviewInstallmentsResult =
  | { status: "success"; preview: InstallmentPreview }
  | Exclude<InstallmentApiResult<InstallmentPreview>, { status: "success" }>;

export type CreateInstallmentsResult =
  | { status: "success"; plan: InstallmentPlan }
  | Exclude<InstallmentApiResult<InstallmentPlan>, { status: "success" }>;

type FetchImplementation = typeof fetch;
type JsonBody = Record<string, string | number | null>;

const DEFAULT_CORE_URL = "http://core-api:3000";
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

function validTimestamp(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d{6}Z$/.exec(value);
  if (!match) return false;
  const parsed = new Date(`${match[1]}.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19) === match[1];
}

function validRequest(request: InstallmentRequest): boolean {
  if (!request || typeof request !== "object") return false;
  if (
    !validTimestamp(request.expectedUpdatedAt) ||
    !Number.isSafeInteger(request.tenorMonths) ||
    request.tenorMonths < 1 ||
    request.tenorMonths > 120 ||
    !validDate(request.firstDueDate) ||
    typeof request.monthlyRatePercent !== "string" ||
    !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/.test(request.monthlyRatePercent)
  ) return false;
  const [whole, fraction = ""] = request.monthlyRatePercent.split(".");
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0")) <= 1_000_000n;
}

function coreUrl(): string {
  return (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
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

function inputValid(telegramUserId: string, transactionId: string, request: InstallmentRequest): boolean {
  return positiveId(telegramUserId) && positiveId(transactionId) && validRequest(request);
}

function requestBody(telegramUserId: string, request: InstallmentRequest): JsonBody {
  return {
    telegramUserId,
    expectedUpdatedAt: request.expectedUpdatedAt,
    tenorMonths: request.tenorMonths,
    monthlyRatePercent: request.monthlyRatePercent,
    firstDueDate: request.firstDueDate
  };
}

function statusResult(status: number): Exclude<PreviewInstallmentsResult, { status: "success" }> {
  if (status === 400) return { status: "validation", fieldErrors: {} };
  if (status === 404) return { status: "not_found" };
  if (status === 409) return { status: "conflict" };
  return { status: "unavailable" };
}

export async function previewInstallments(
  telegramUserId: string,
  transactionId: string,
  request: InstallmentRequest,
  fetchImpl: FetchImplementation = fetch
): Promise<PreviewInstallmentsResult> {
  if (!inputValid(telegramUserId, transactionId, request)) return { status: "unavailable" };
  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/transactions/${encodeURIComponent(transactionId)}/installments/preview`,
      requestOptions(requestBody(telegramUserId, request))
    );
    if (response.status !== 200) return statusResult(response.status);
    return { status: "success", preview: parseInstallmentPreview(await response.json()) };
  } catch {
    return { status: "unavailable" };
  }
}

export async function createInstallments(
  telegramUserId: string,
  transactionId: string,
  request: InstallmentRequest,
  fetchImpl: FetchImplementation = fetch
): Promise<CreateInstallmentsResult> {
  if (!inputValid(telegramUserId, transactionId, request)) return { status: "unavailable" };
  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/transactions/${encodeURIComponent(transactionId)}/installments`,
      requestOptions(requestBody(telegramUserId, request))
    );
    if (response.status !== 200) return statusResult(response.status) as Exclude<CreateInstallmentsResult, { status: "success" }>;
    return { status: "success", plan: parseInstallmentPlan(await response.json()) };
  } catch {
    return { status: "unavailable" };
  }
}
