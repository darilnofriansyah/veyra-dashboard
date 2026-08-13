export interface RawTransactionSearchParams {
  [key: string]: string | readonly string[] | null | undefined;
}

export interface TransactionFilters {
  cycle: "current" | "previous" | null;
  category: string | null;
  type: "income" | "expense" | null;
  search: string | null;
  cursor: string | null;
  direction: "next" | "previous" | null;
}

const MAX_TEXT_LENGTH = 200;
const MAX_CURSOR_LENGTH = 512;
const FILTER_KEYS = ["cycle", "category", "type", "search"] as const;

function singleValue(raw: RawTransactionSearchParams, name: string): string | null {
  const value = raw[name];
  return typeof value === "string" ? value.trim() || null : null;
}

function boundedText(value: string | null, maxLength: number): string | null {
  return value && value.length <= maxLength ? value : null;
}

function enumValue<T extends string>(value: string | null, values: readonly T[]): T | null {
  return value && values.includes(value as T) ? value as T : null;
}

function changedFilter(
  before: TransactionFilters,
  after: TransactionFilters,
  changes: Partial<TransactionFilters>
): boolean {
  return FILTER_KEYS.some((key) =>
    Object.hasOwn(changes, key) && before[key] !== after[key]
  );
}

function rawFilters(filters: TransactionFilters): RawTransactionSearchParams {
  return {
    cycle: filters.cycle,
    category: filters.category,
    type: filters.type,
    search: filters.search,
    cursor: filters.cursor,
    direction: filters.direction
  };
}

export function parseTransactionFilters(raw: RawTransactionSearchParams): TransactionFilters {
  const cursor = boundedText(singleValue(raw, "cursor"), MAX_CURSOR_LENGTH);
  const direction = cursor
    ? enumValue(singleValue(raw, "direction"), ["next", "previous"])
    : null;

  return {
    cycle: enumValue(singleValue(raw, "cycle"), ["current", "previous"]),
    category: boundedText(singleValue(raw, "category"), MAX_TEXT_LENGTH),
    type: enumValue(singleValue(raw, "type"), ["income", "expense"]),
    search: boundedText(singleValue(raw, "search"), MAX_TEXT_LENGTH),
    cursor,
    direction
  };
}

export function transactionHref(
  filters: TransactionFilters,
  changes: Partial<TransactionFilters>
): string {
  const normalized = parseTransactionFilters(rawFilters(filters));
  const updated = parseTransactionFilters({ ...rawFilters(normalized), ...changes });
  const next = changedFilter(normalized, updated, changes)
    ? { ...updated, cursor: null, direction: null }
    : updated;
  const parameters = new URLSearchParams();

  appendParameter(parameters, "cycle", next.cycle);
  appendParameter(parameters, "category", next.category);
  appendParameter(parameters, "type", next.type);
  appendParameter(parameters, "search", next.search);
  appendParameter(parameters, "cursor", next.cursor);
  appendParameter(parameters, "direction", next.direction);

  const query = parameters.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

function appendParameter(parameters: URLSearchParams, name: string, value: string | null): void {
  if (value) parameters.set(name, value);
}
