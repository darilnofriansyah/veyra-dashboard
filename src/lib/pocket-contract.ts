export interface Pocket {
  id: string;
  name: string;
  amount: number | null;
  isDefault: boolean;
}

type PocketField = "pocketId" | "name" | "amount";

export type PocketActionState =
  | { status: "idle" }
  | { status: "validation"; fieldErrors: Partial<Record<PocketField, string>> }
  | { status: "not_found" | "unavailable" | "success" };

type PocketValidation = Extract<PocketActionState, { status: "validation" }>;
type Parsed<T> = { ok: true; value: T } | { ok: false; state: PocketValidation };
type PocketFormField = "pocketId" | "name" | "amount";
type JsonObject = Record<string, unknown>;

const NAME_LIMIT = 200;
const ID_PATTERN = /^[1-9]\d*$/;
const AMOUNT_PATTERN = /^[1-9]\d*$/;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown): JsonObject {
  if (!isObject(value)) throw new Error("Invalid pocket");
  return value;
}

function validName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid pocket name");
  const name = value.trim();
  if (name.length > NAME_LIMIT) throw new Error("Invalid pocket name");
  return name;
}

function validId(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error("Invalid pocket ID");
  return value;
}

function validAmount(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid pocket amount");
  }
  return value;
}

export function parsePocket(value: unknown): Pocket {
  const item = object(value);
  if (typeof item.isDefault !== "boolean") throw new Error("Invalid pocket default");
  return {
    id: validId(item.id),
    name: validName(item.name),
    amount: validAmount(item.amount),
    isDefault: item.isDefault
  };
}

function exactString(formData: FormData, field: PocketFormField): string | undefined {
  const values = formData.getAll(field);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : undefined;
}

function validation(fieldErrors: Partial<Record<PocketField, string>>): { ok: false; state: PocketValidation } {
  return { ok: false, state: { status: "validation", fieldErrors } };
}

function pocketId(formData: FormData, errors: Partial<Record<PocketField, string>>): string | undefined {
  const value = exactString(formData, "pocketId")?.trim();
  if (!value || !ID_PATTERN.test(value)) errors.pocketId = "Select a valid pocket.";
  return value && ID_PATTERN.test(value) ? value : undefined;
}

function name(formData: FormData, errors: Partial<Record<PocketField, string>>): string | undefined {
  const value = exactString(formData, "name")?.trim();
  if (!value) errors.name = "Enter a pocket name.";
  else if (value.length > NAME_LIMIT) errors.name = "Pocket name must be 200 characters or fewer.";
  return value && value.length <= NAME_LIMIT ? value : undefined;
}

function amount(formData: FormData, errors: Partial<Record<PocketField, string>>): number | undefined {
  const value = exactString(formData, "amount")?.trim();
  const parsed = value && AMOUNT_PATTERN.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) errors.amount = "Enter a positive whole-rupiah amount.";
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseCreatePocketForm(formData: FormData): Parsed<{ name: string }> {
  const errors: Partial<Record<PocketField, string>> = {};
  const value = name(formData, errors);
  if (value === undefined || Object.keys(errors).length) return validation(errors);
  return { ok: true, value: { name: value } };
}

export function parseRenamePocketForm(formData: FormData): Parsed<{ pocketId: string; name: string }> {
  const errors: Partial<Record<PocketField, string>> = {};
  const pocket = pocketId(formData, errors);
  const pocketName = name(formData, errors);
  if (pocket === undefined || pocketName === undefined || Object.keys(errors).length) return validation(errors);
  return { ok: true, value: { pocketId: pocket, name: pocketName } };
}

export function parsePocketBudgetForm(formData: FormData): Parsed<{ pocketId: string; amount: number }> {
  const errors: Partial<Record<PocketField, string>> = {};
  const pocket = pocketId(formData, errors);
  const value = amount(formData, errors);
  if (pocket === undefined || value === undefined || Object.keys(errors).length) return validation(errors);
  return { ok: true, value: { pocketId: pocket, amount: value } };
}

export function parseDefaultPocketForm(formData: FormData): Parsed<{ pocketId: string }> {
  const errors: Partial<Record<PocketField, string>> = {};
  const value = pocketId(formData, errors);
  if (value === undefined || Object.keys(errors).length) return validation(errors);
  return { ok: true, value: { pocketId: value } };
}
