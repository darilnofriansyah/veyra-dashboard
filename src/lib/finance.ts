export type Period = "current" | "previous";
export type BudgetStatus = "on-track" | "warning" | "over";

export interface Totals {
  income: number;
  spent: number;
  netCashflow: number;
  dailyAverage: number;
}

export interface BudgetSummary {
  category: string;
  limit: number;
  spent: number;
  percent: number;
  status: BudgetStatus;
}

export interface PeriodOverview {
  period: {
    label: "current_cycle" | "previous_cycle";
    start: string;
    end: string;
  };
  hasTransactions: boolean;
  totals: Totals;
  comparison: Totals;
  dailySpend: Array<{ date: string; amount: number }>;
  categories: Array<{
    category: string;
    amount: number;
    percent: number;
    transactionCount: number;
  }>;
  budgets: BudgetSummary[];
  recentTransactions: Array<{
    id: string;
    date: string;
    merchant: string | null;
    category: string | null;
    amount: number;
    type: "income" | "expense";
  }>;
  alert: BudgetSummary | null;
}

export type OverviewSummary = PeriodOverview;

export interface OverviewResponse {
  user: {
    id: string;
    telegramUserId: string;
  };
  current: PeriodOverview;
  previous: PeriodOverview;
}

const formatter = new Intl.NumberFormat("en-ID", {
  style: "currency",
  currency: "IDR",
  currencyDisplay: "code",
  maximumFractionDigits: 0
});

export function formatIdr(value: number) {
  return formatter.format(value).replace(/\u00a0/g, " ");
}
