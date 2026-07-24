"use client";

import { Gauge, House, Receipt, Sparkle, TrendUp, Wallet, Warning } from "@phosphor-icons/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { SpendingTrend } from "@/components/spending-trend";
import { comparison } from "@/lib/dashboard-display";
import { createFixtureData } from "@/lib/fixtures";
import { formatIdr, summarizeOverview, type Period } from "@/lib/finance";

const panel = "min-w-0 rounded-veyra border border-veyra-line bg-white p-3";
const label = "text-xs font-medium text-slate-500";
const value = "mt-1 block text-xl font-bold tracking-[-0.03em] text-veyra-ink";
const retry = "mt-3 inline-block rounded-lg border border-veyra-line px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:border-veyra-cyan motion-reduce:transition-none";
const transactionDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

type DemoState = "empty" | "budget-error" | "transaction-error" | "error";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const formatCycle = (selectedPeriod: Period, today: string) => {
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const selected = new Date(Date.UTC(year, month - 1 + (selectedPeriod === "previous" ? -1 : 0), 1));
  const selectedYear = selected.getUTCFullYear();
  const selectedMonth = selected.getUTCMonth();
  const lastDay = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(selected);
  return `1–${lastDay} ${monthName} ${selectedYear}`;
};

function Unavailable({ children }: { children: string }) {
  return (
    <div className="grid min-h-24 place-content-center text-center">
      <p className="text-sm text-slate-600">{children}</p>
      <a href="/" className={retry}>Retry</a>
    </div>
  );
}

function DashboardContent({ demoState }: { demoState: DemoState | null }) {
  const [period, setPeriod] = useState<Period>("current");
  const now = useMemo(jakartaToday, []);
  const fixture = useMemo(() => createFixtureData(now), [now]);
  const summary = useMemo(
    () => summarizeOverview({
      ...fixture,
      transactions: demoState === "empty" ? [] : fixture.transactions,
      period,
      now
    }),
    [demoState, fixture, period, now]
  );
  const cycleLabel = formatCycle(period, now);
  const transactionError = demoState === "transaction-error";
  const budgetError = demoState === "budget-error";
  const guidanceError = transactionError
    ? "Transaction data couldn’t be loaded."
    : budgetError
      ? "Budget data couldn’t be loaded."
      : null;
  const metrics = [
    { label: "Total Spent", value: summary.totalSpent, previous: summary.comparison.totalSpent, lowerIsBetter: true, icon: Receipt },
    { label: "Total Income", value: summary.totalIncome, previous: summary.comparison.totalIncome, lowerIsBetter: false, icon: Wallet },
    { label: "Net Cashflow", value: summary.netCashflow, previous: summary.comparison.netCashflow, lowerIsBetter: false, icon: TrendUp },
    { label: "Daily Average Spend", value: summary.dailyAverage, previous: summary.comparison.dailyAverage, lowerIsBetter: true, icon: Gauge }
  ];

  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
      <a href="#overview" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-veyra-navy focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white">Skip to overview</a>
      <aside className="flex flex-wrap items-center gap-4 border-b border-veyra-line bg-white p-4 xl:block xl:min-h-dvh xl:border-b-0 xl:border-r xl:p-6">
        <Image src="/assets/veyra-logo.png" width={840} height={194} sizes="124px" alt="Veyra" className="h-auto w-[124px]" preload />
        <nav aria-label="Primary" className="order-2 basis-full xl:mt-8">
          <a href="#overview" aria-current="page" className="flex items-center gap-2 rounded-lg border-l-[3px] border-veyra-cyan bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700 transition-colors motion-reduce:transition-none">
            <House size={16} weight="duotone" aria-hidden="true" />
            Overview
          </a>
        </nav>
        <section aria-label="Current account" className="order-1 ml-auto flex min-w-0 items-center gap-3 xl:fixed xl:bottom-6 xl:ml-0">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-veyra-navy text-xs font-semibold text-white">KR</span>
          <div className="min-w-0"><strong className="block text-sm">Kaito Ren</strong><span className="text-xs text-slate-500">{cycleLabel}</span></div>
        </section>
      </aside>

      <main id="overview" className="p-4">
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
          <div><h1 className="text-2xl font-bold">Overview</h1><p className="mt-1 text-sm text-slate-500">Here’s your financial summary.</p></div>
          <label><span className="sr-only">Period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="block rounded-lg border border-veyra-line bg-white px-3 py-2 text-sm text-veyra-ink transition-colors motion-reduce:transition-none">
              <option value="current">This Month</option>
              <option value="previous">Last Month</option>
            </select>
          </label>
        </header>
        <output className="sr-only" aria-live="polite">{period === "current" ? "This Month" : "Last Month"} selected.</output>

        {demoState === "error" ? (
          <section className={panel} aria-label="Financial summary error">
            <Unavailable>Your financial summary couldn’t be loaded.</Unavailable>
          </section>
        ) : (
          <>
            <section aria-label="Financial health" className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {transactionError ? (
                <article className={`${panel} md:col-span-2 xl:col-span-4`}>
                  <Unavailable>Transaction data couldn’t be loaded.</Unavailable>
                </article>
              ) : metrics.map((metric) => {
                const delta = comparison(metric.value, metric.previous, metric.lowerIsBetter);
                const Icon = metric.icon;
                return (
                  <article key={metric.label} className={panel}>
                    <span className="flex items-center justify-between gap-2">
                      <span className={label}>{metric.label}</span>
                      <Icon size={16} weight="duotone" aria-hidden="true" className="text-veyra-cyan" />
                    </span>
                    <strong className={value}>{summary.hasTransactions ? formatIdr(metric.value) : "—"}</strong>
                    <span className={`mt-1.5 block text-xs ${delta.className}`}>{summary.hasTransactions ? delta.text : "No activity"}</span>
                  </article>
                );
              })}
            </section>

            <section className="mt-2.5 grid gap-2.5 xl:grid-cols-[1.6fr_1fr]">
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Spending Trend</h2>
                {transactionError ? <Unavailable>Transaction data couldn’t be loaded.</Unavailable> : <SpendingTrend points={summary.dailySpend} />}
              </article>
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Spending by Category</h2>
                {transactionError ? <Unavailable>Transaction data couldn’t be loaded.</Unavailable> : <CategoryBreakdown categories={summary.categories} />}
              </article>
            </section>

            <section className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Budget Status</h2>
                {transactionError || budgetError ? <Unavailable>{guidanceError!}</Unavailable> : summary.budgets.map((budget) => (
                  <div key={budget.category} className="grid grid-cols-[1fr_auto] gap-1 border-b border-veyra-line py-1">
                    <div><strong className="text-sm">{budget.category}</strong><span className="block text-xs text-slate-500">{formatIdr(budget.spent)} / {formatIdr(budget.limit)}</span></div>
                    <span className="text-xs">{budget.percent}%</span>
                    <progress
                      max="100"
                      value={Math.min(budget.percent, 100)}
                      aria-label={`${budget.category} budget used: ${budget.percent}%`}
                      data-status={budget.percent > 100 ? "danger" : budget.percent >= 80 ? "warning" : "healthy"}
                      className="budget-progress col-span-2 h-1.5 w-full"
                    >{budget.percent}%</progress>
                  </div>
                ))}
              </article>
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Recent Transactions</h2>
                {transactionError ? <Unavailable>Transaction data couldn’t be loaded.</Unavailable> : summary.recentTransactions.length ? (
                  <div className="overflow-x-auto"><table className="w-full text-left text-xs">
                    <thead className="text-slate-500"><tr><th scope="col" className="p-1.5">Date</th><th scope="col" className="p-1.5">Merchant</th><th scope="col" className="p-1.5">Category</th><th scope="col" className="p-1.5 text-right">Amount</th></tr></thead>
                    <tbody>{summary.recentTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-veyra-line">
                      <td className="p-1.5"><time dateTime={transaction.date}>{transactionDate.format(new Date(`${transaction.date}T00:00:00Z`))}</time></td><td className="p-1.5">{transaction.merchant}</td><td className="p-1.5">{transaction.category}</td>
                      <td className={`p-1.5 text-right ${transaction.type === "income" ? "text-veyra-success" : ""}`}>{transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}</td>
                    </tr>)}</tbody>
                  </table></div>
                ) : <p className="text-sm">No transactions for this period.</p>}
              </article>
            </section>

            <section className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
              <article className={`${panel} border-t-[3px] border-t-veyra-warning`}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Warning size={16} weight="duotone" aria-hidden="true" />Latest Alert</h2>
                {guidanceError ? <Unavailable>{guidanceError}</Unavailable> : <p className="text-sm">{summary.alert && summary.alert.percent >= 80 ? `${summary.alert.category} budget is at ${summary.alert.percent}%.` : "Tracked budgets are on course."}</p>}
              </article>
              <article id="veyra-insight" className={`${panel} relative min-h-40 overflow-hidden`}>
                <picture aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[48%] max-w-[280px]">
                  <source srcSet="/assets/veyra-dashboard-portrait.webp" type="image/webp" />
                  <Image src="/assets/veyra-dashboard-portrait.png" alt="" fill sizes="280px" className="origin-top-right scale-[2] object-contain object-right-top" preload />
                </picture>
                <div className="max-w-[52%]">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Sparkle size={16} weight="duotone" aria-hidden="true" />Veyra</h2>
                  {guidanceError ? <Unavailable>{guidanceError}</Unavailable> : <p className="text-sm">{summary.hasTransactions ? summary.insight : "No transactions for this period."}</p>}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function DevelopmentDashboard() {
  const requestedState = useSearchParams().get("state");
  const demoState = ["empty", "budget-error", "transaction-error", "error"].includes(requestedState ?? "")
    ? requestedState as DemoState
    : null;
  return <DashboardContent demoState={demoState} />;
}

export function OverviewDashboard() {
  return process.env.NODE_ENV === "development" ? (
    <Suspense>
      <DevelopmentDashboard />
    </Suspense>
  ) : <DashboardContent demoState={null} />;
}
