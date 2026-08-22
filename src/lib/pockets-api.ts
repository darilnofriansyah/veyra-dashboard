import "server-only";
import { parsePocket, type Pocket, type PocketActionState } from "./pocket-contract.ts";

export interface LoadPocketsResult {
  pockets: Pocket[];
  error: boolean;
}

type ActionResult = Exclude<PocketActionState, { status: "idle" }>;
type JsonBody = Record<string, string | number>;

const DEFAULT_CORE_URL = "http://core-api:3000";
const REQUEST_TIMEOUT_MS = 5_000;
const ID_PATTERN = /^[1-9]\d*$/;

function coreUrl(): string {
  return (process.env.NEXUS_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/+$/, "");
}

function headers(): HeadersInit {
  const apiKey = process.env.CORE_API_KEY;
  return { "content-type": "application/json", ...(apiKey ? { "x-core-api-key": apiKey } : {}) };
}

function requestOptions(body: JsonBody): RequestInit {
  return {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: headers(),
    body: JSON.stringify(body)
  };
}

function validId(value: string): boolean {
  return ID_PATTERN.test(value);
}

function validName(value: string): string | null {
  const name = value.trim();
  return name && name.length <= 200 ? name : null;
}

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function parsePockets(value: unknown): Pocket[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pockets");
  const response = value as Record<string, unknown>;
  if (response.status !== "ok" || !Array.isArray(response.pockets)) throw new Error("Invalid pockets");
  return response.pockets.map(parsePocket);
}

function parseBudget(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid budget");
  const budget = value as Record<string, unknown>;
  if (
    typeof budget.budget_id !== "string" || !validId(budget.budget_id)
    || typeof budget.category !== "string" || !validName(budget.category)
    || typeof budget.amount !== "number" || !validAmount(budget.amount)
    || budget.parent_budget_id !== null || budget.parent_category !== null
    || budget.period_type !== "monthly"
    || (budget.action !== "created" && budget.action !== "updated")
  ) throw new Error("Invalid budget");
}

const unavailable = (): ActionResult => ({ status: "unavailable" });
const validation = (): ActionResult => ({ status: "validation", fieldErrors: {} });

export async function loadPockets(telegramUserId: string, fetchImpl: typeof fetch = fetch): Promise<LoadPocketsResult> {
  if (!validId(telegramUserId)) return { pockets: [], error: true };
  try {
    const response = await fetchImpl(
      `${coreUrl()}/api/veyra/budgets/pockets/list`,
      requestOptions({ userId: telegramUserId })
    );
    if (response.status !== 200 && response.status !== 201) return { pockets: [], error: true };
    return { pockets: parsePockets(await response.json()), error: false };
  } catch {
    return { pockets: [], error: true };
  }
}

async function mutatePocket(
  path: string,
  body: JsonBody,
  parseSuccess: (value: unknown) => void,
  fetchImpl: typeof fetch
): Promise<ActionResult> {
  try {
    const response = await fetchImpl(`${coreUrl()}${path}`, requestOptions(body));
    if (response.status === 400) return validation();
    if (response.status === 404) return { status: "not_found" };
    if (response.status !== 200 && response.status !== 201) return unavailable();
    parseSuccess(await response.json());
    return { status: "success" };
  } catch {
    return unavailable();
  }
}

export async function createPocket(
  telegramUserId: string,
  input: { name: string; amount: number },
  fetchImpl: typeof fetch = fetch
): Promise<ActionResult> {
  const name = validName(input.name);
  if (!validId(telegramUserId) || !name || !validAmount(input.amount)) return validation();
  return mutatePocket(
    "/api/veyra/budgets/upsert",
    { telegramUserId, category: name, amount: input.amount, periodType: "monthly" },
    parseBudget,
    fetchImpl
  );
}

export async function updatePocketBudget(
  telegramUserId: string,
  name: string,
  amount: number,
  fetchImpl: typeof fetch = fetch
): Promise<ActionResult> {
  return createPocket(telegramUserId, { name, amount }, fetchImpl);
}

export async function renamePocket(
  telegramUserId: string,
  pocketId: string,
  name: string,
  fetchImpl: typeof fetch = fetch
): Promise<ActionResult> {
  const trimmedName = validName(name);
  if (!validId(telegramUserId) || !validId(pocketId) || !trimmedName) return validation();
  return mutatePocket(
    "/api/veyra/budgets/pockets/rename",
    { telegramUserId, pocketId, name: trimmedName },
    (value) => { parsePocket(value); },
    fetchImpl
  );
}

export async function setDefaultPocket(
  telegramUserId: string,
  pocketId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ActionResult> {
  if (!validId(telegramUserId) || !validId(pocketId)) return validation();
  return mutatePocket(
    "/api/veyra/budgets/pockets/default",
    { telegramUserId, pocketId },
    (value) => { parsePocket(value); },
    fetchImpl
  );
}
