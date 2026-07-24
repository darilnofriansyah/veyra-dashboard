export type Period = "current" | "previous";

export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense";
};

export type Budget = { category: string; limit: number };
export type OverviewInput = { transactions: Transaction[]; budgets: Budget[]; period: Period; now: string };

export type Totals = {
  totalIncome: number;
  totalSpent: number;
  netCashflow: number;
  dailyAverage: number;
};

export type BudgetSummary = Budget & { spent: number; percent: number };

export type OverviewSummary = Totals & {
  hasTransactions: boolean;
  comparison: Totals;
  dailySpend: { date: string; amount: number }[];
  categories: { category: string; amount: number; percent: number }[];
  budgets: BudgetSummary[];
  recentTransactions: Transaction[];
  alert: BudgetSummary | null;
  insight: string;
};

const formatter = new Intl.NumberFormat("en-ID", {
  style: "currency",
  currency: "IDR",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

export function formatIdr(value: number) {
  return formatter.format(value).replace(/\u00a0/g, " ");
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function monthKey(date: string, offset = 0) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validateOverviewInput(input: OverviewInput) {
  if (!isDate(input.now)) throw new Error("Invalid now date");
  const ids = new Set<string>();

  for (const transaction of input.transactions) {
    if (!isDate(transaction.date)) throw new Error("Invalid transaction date");
    if (ids.has(transaction.id)) throw new Error("Duplicate transaction id");
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount < 0) {
      throw new Error("Transaction amounts must be whole non-negative rupiah");
    }
    ids.add(transaction.id);
  }

  for (const budget of input.budgets) {
    if (!Number.isSafeInteger(budget.limit) || budget.limit <= 0) {
      throw new Error("Budget limits must be positive whole rupiah");
    }
  }
}

function totals(transactions: Transaction[], days: number): Totals {
  const totalIncome = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSpent = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
  return { totalIncome, totalSpent, netCashflow: totalIncome - totalSpent, dailyAverage: Math.round(totalSpent / days) };
}

export function summarizeOverview(input: OverviewInput): OverviewSummary {
  validateOverviewInput(input);
  const currentKey = monthKey(input.now);
  const selectedKey = monthKey(input.now, input.period === "previous" ? -1 : 0);
  const comparisonKey = monthKey(selectedKey + "-01", -1);
  const elapsedDays = Number(input.now.slice(-2));
  const selectedDays = input.period === "current" ? elapsedDays : daysInMonth(selectedKey);
  const comparisonDays = input.period === "current" ? Math.min(elapsedDays, daysInMonth(comparisonKey)) : daysInMonth(comparisonKey);
  const inPeriod = (transaction: Transaction, key: string, maxDay: number) => transaction.date.startsWith(key) && Number(transaction.date.slice(-2)) <= maxDay;
  const selected = input.transactions.filter((transaction) => inPeriod(transaction, selectedKey, selectedDays));
  const compared = input.transactions.filter((transaction) => inPeriod(transaction, comparisonKey, comparisonDays));
  const knownCategories = new Set(input.budgets.map((budget) => budget.category));
  const expenses = selected.filter((transaction) => transaction.type === "expense");
  const amountsByCategory = new Map<string, number>();
  const addCategory = (category: string, amount: number) => amountsByCategory.set(category, (amountsByCategory.get(category) ?? 0) + amount);

  for (const transaction of expenses) addCategory(knownCategories.has(transaction.category) ? transaction.category : "Others", transaction.amount);

  const rankedCategories = [...amountsByCategory]
    .filter(([category]) => category !== "Others")
    .sort(([, left], [, right]) => right - left);
  const topCategories = rankedCategories.slice(0, 5);
  const otherAmount = (amountsByCategory.get("Others") ?? 0) + rankedCategories.slice(5).reduce((sum, [, amount]) => sum + amount, 0);
  if (otherAmount) topCategories.push(["Others", otherAmount]);
  const totalSpent = expenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const categories = topCategories.map(([category, amount]) => ({ category, amount, percent: totalSpent ? Math.round((amount / totalSpent) * 100) : 0 }));

  const allBudgets = input.budgets.map((budget) => {
    const spent = amountsByCategory.get(budget.category) ?? 0;
    return { ...budget, spent, percent: Math.round((spent / budget.limit) * 100) };
  });
  const rankBudgets = (left: BudgetSummary, right: BudgetSummary) => right.spent - left.spent || right.percent - left.percent;
  const budgets = [...allBudgets].sort(rankBudgets).slice(0, 4);
  const alert = [...allBudgets]
    .filter((budget) => budget.percent >= 80)
    .sort((left, right) => Number(right.percent > 100) - Number(left.percent > 100) || right.percent - left.percent)[0] ?? null;
  const dailySpend = [...expenses.reduce((days, transaction) => {
    days.set(transaction.date, (days.get(transaction.date) ?? 0) + transaction.amount);
    return days;
  }, new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right)).map(([date, amount]) => ({ date, amount }));
  const recentTransactions = [...selected].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id)).slice(0, 5);
  const summary = totals(selected, selectedDays);
  const comparison = totals(compared, comparisonDays);
  const highestCategory = categories[0];

  return {
    hasTransactions: selected.length > 0,
    ...summary,
    comparison,
    dailySpend,
    categories,
    budgets,
    recentTransactions,
    alert,
    insight: highestCategory ? `${highestCategory.category} is your largest expense at ${highestCategory.percent}% of spending.` : "There is not enough activity to form an insight."
  };
}
