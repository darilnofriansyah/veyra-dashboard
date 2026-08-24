"use client";

import { CreditCard, Sparkle, Warning } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { SpendingTrend } from "@/components/spending-trend";
import { attentionPreview, comparison } from "@/lib/dashboard-display";
import { creditUsagePercent, formatIdr, type BudgetAttention, type BudgetStatus, type Period } from "@/lib/finance";
import type { OverviewLoaderResult } from "@/lib/overview-loader";

const panel = "min-w-0 rounded-veyra border border-veyra-line bg-white p-3";
const label = "text-xs font-medium text-slate-500";
const value = "mt-1 block text-xl font-bold tracking-[-0.03em] text-veyra-ink";
const retry = "mt-3 inline-block rounded-lg border border-veyra-line px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:border-veyra-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.98] motion-reduce:transition-none";
const transactionDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const statusLabel: Record<BudgetStatus, string> = { "on-track": "On track", warning: "Warning", over: "Over budget" };

const cycleDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

const formatCycle = (start: string, exclusiveEnd: string) => {
  const end = new Date(`${exclusiveEnd}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${cycleDate.format(new Date(`${start}T00:00:00Z`))}–${cycleDate.format(end)}`;
};

function Unavailable({ children }: { children: string }) {
  const router = useRouter();
  return (
    <div className="grid min-h-24 place-content-center text-center">
      <p className="text-sm text-slate-600">{children}</p>
      <button type="button" onClick={() => router.refresh()} className={retry}>Retry</button>
    </div>
  );
}

function AttentionItem({ item }: { item: BudgetAttention }) {
  return (
    <li className="grid min-w-0 gap-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] md:items-center">
      <div className="min-w-0">
        <h3 className="break-words font-bold text-veyra-ink">{item.pocketName}</h3>
        <p className="mt-1 break-words text-sm text-slate-600">Top driver: {item.topDriver.category} · {formatIdr(item.topDriver.amount)}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div><dt className={label}>Current</dt><dd className="mt-1 font-semibold tabular-nums">{formatIdr(item.spent)} / {formatIdr(item.limit)}</dd></div>
        <div><dt className={label}>Projected</dt><dd className="mt-1 font-semibold tabular-nums">{formatIdr(item.projectedSpend)}</dd></div>
        <div><dt className={label}>Overrun</dt><dd className="mt-1 font-semibold tabular-nums text-veyra-danger">{formatIdr(item.projectedOverrun)}</dd></div>
        <div><dt className={label}>Safe Daily Spend</dt><dd className="mt-1 font-semibold tabular-nums">{formatIdr(item.safeDailySpend)}</dd></div>
      </dl>
      <Link href={`/pockets/${item.pocketId}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-veyra-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-veyra-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.98] motion-reduce:transition-none">
        View Pocket
      </Link>
    </li>
  );
}

export function OverviewDashboard({
  data,
  viewerName
}: {
  data: OverviewLoaderResult;
  viewerName: string | null;
}) {
  const [period, setPeriod] = useState<Period>("current");
  const summary = data.data?.[period] ?? null;
  const creditUsage = summary
    ? creditUsagePercent(summary.creditCard.used, summary.creditCard.limit)
    : 0;
  const cycleLabel = summary
    ? formatCycle(summary.period.start, summary.period.end)
    : "Cycle unavailable";
  const attention = attentionPreview(period === "current" ? data.data?.current.attention ?? [] : []);
  const highestCategory = summary?.categories[0] ?? null;
  const insight = highestCategory
    ? `${highestCategory.category} ${period === "current" ? "is" : "was"} your largest expense at ${highestCategory.percent}% of spending.`
    : "There is not enough activity to form an insight.";
  const neutralDelta = { text: "No activity", className: "text-slate-500" };
  const spentDelta = summary
    ? comparison(summary.totals.spent, summary.comparison.spent, true)
    : neutralDelta;
  const incomeDelta = summary
    ? comparison(summary.totals.income, summary.comparison.income, false)
    : neutralDelta;
  const cashflowDelta = summary
    ? comparison(summary.totals.netCashflow, summary.comparison.netCashflow, false)
    : neutralDelta;
  const averageDelta = summary
    ? comparison(summary.totals.dailyAverage, summary.comparison.dailyAverage, true)
    : neutralDelta;

  return (
    <AppShell
      activePage="overview"
      viewerName={viewerName}
      accountContext={cycleLabel}
      mainId="overview"
      skipLabel="Skip to overview"
    >
      <div className="mx-auto max-w-[1280px] xl:px-2 xl:py-1">
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
          <div><h1 className="text-2xl font-bold">Overview</h1><p className="mt-1 text-sm text-slate-500">Here’s your financial summary.</p></div>
          <label><span className="sr-only">Period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="block rounded-lg border border-veyra-line bg-white px-3 py-2 text-sm text-veyra-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 motion-reduce:transition-none">
              <option value="current">Current Cycle</option>
              <option value="previous">Previous Cycle</option>
            </select>
          </label>
        </header>
        <output className="sr-only" aria-live="polite">{period === "current" ? "Current Cycle" : "Previous Cycle"} selected.</output>

        {data.error || !summary ? (
          <section className={panel} aria-label="Financial summary error">
            <Unavailable>Your financial summary couldn’t be loaded.</Unavailable>
          </section>
        ) : (
          <>
            {attention.items.length > 0 && (
              <section aria-labelledby="attention-title" className={`${panel} mb-2.5 border-t-[3px] border-t-veyra-warning p-4`}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Current Cycle</p>
                  <h2 id="attention-title" className="mt-1 flex items-center gap-2 text-lg font-bold tracking-[-0.02em]">
                    <Warning size={18} weight="duotone" aria-hidden="true" />
                    Needs Attention
                  </h2>
                </div>
                <ul className="mt-4 divide-y divide-veyra-line border-y border-veyra-line">
                  {attention.items.map((item) => <AttentionItem key={item.pocketId} item={item} />)}
                </ul>
                {attention.hasMore && (
                  <details className="mt-2">
                    <summary className="flex min-h-10 cursor-pointer items-center rounded-lg px-2 text-sm font-semibold text-sky-700 hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.98]">
                      View all at-risk pockets
                    </summary>
                    <ul className="divide-y divide-veyra-line border-y border-veyra-line">
                      {attention.remaining.map((item) => <AttentionItem key={item.pocketId} item={item} />)}
                    </ul>
                  </details>
                )}
              </section>
            )}
            <section aria-label="Financial pulse" className={`${panel} grid gap-5 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]`}>
              <div className="min-w-0">
                <span className={label}>Net Cashflow</span>
                <strong className="mt-1 block text-3xl font-bold tracking-[-0.05em] tabular-nums text-veyra-ink">
                  {summary.hasTransactions ? formatIdr(summary.totals.netCashflow) : "—"}
                </strong>
                <span className={`mt-1.5 block text-xs ${cashflowDelta.className}`}>
                  {summary.hasTransactions ? cashflowDelta.text : "No activity"}
                </span>
                <div className="mt-5 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                  <div className="min-w-0">
                    <span className={label}>Total Income</span>
                    <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.income) : "—"}</strong>
                    <span className={`mt-1.5 block text-xs ${incomeDelta.className}`}>{summary.hasTransactions ? incomeDelta.text : "No activity"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className={label}>Total Spent</span>
                    <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.spent) : "—"}</strong>
                    <span className={`mt-1.5 block text-xs ${spentDelta.className}`}>{summary.hasTransactions ? spentDelta.text : "No activity"}</span>
                  </div>
                </div>
                <div className="mt-4 border-t border-veyra-line pt-3">
                  <span className={label}>Daily Average Spend</span>
                  <strong className={value}>{summary.hasTransactions ? formatIdr(summary.totals.dailyAverage) : "—"}</strong>
                  <span className={`mt-1.5 block text-xs ${averageDelta.className}`}>{summary.hasTransactions ? averageDelta.text : "No activity"}</span>
                </div>
              </div>
              <section aria-label="Credit card" className="min-w-0 border-t border-veyra-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <CreditCard size={16} weight="duotone" aria-hidden="true" className="text-veyra-cyan" />
                  Credit Card
                </h2>
                <span className={`${label} mt-4 block`}>Amount to Pay</span>
                <strong className="mt-1 block text-2xl font-bold tracking-[-0.04em] tabular-nums text-veyra-ink">{formatIdr(summary.creditCard.statementBalance)}</strong>
                <span className={`${label} mt-4 block`}>Credit Used</span>
                <strong className={value}>{formatIdr(summary.creditCard.used)}</strong>
                <progress max="100" value={Math.min(creditUsage, 100)} aria-label={`Credit card used: ${formatIdr(summary.creditCard.used)} of ${formatIdr(summary.creditCard.limit)}, ${creditUsage}%`} className="budget-progress mt-3 h-1.5 w-full">{creditUsage}%</progress>
                <span className="mt-1.5 block text-xs text-slate-500">{creditUsage}% of {formatIdr(summary.creditCard.limit)} limit</span>
              </section>
            </section>

            <section className="mt-2.5 grid gap-2.5 xl:grid-cols-[1.6fr_1fr]">
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Spending Trend</h2>
                <SpendingTrend
                  points={summary.dailySpend}
                  start={summary.period.start}
                  exclusiveEnd={summary.period.end}
                />
              </article>
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Spending by Category</h2>
                <CategoryBreakdown categories={summary.categories} />
              </article>
            </section>

            <section className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Budget Status</h2>
                {summary.budgets.map((budget) => (
                  <div key={budget.category} data-status={budget.status} className="grid grid-cols-[1fr_auto] gap-1 border-b border-veyra-line py-1">
                    <div><strong className="text-sm">{budget.category}</strong><span className="block text-xs text-slate-500">{formatIdr(budget.spent)} / {formatIdr(budget.limit)}</span></div>
                    <span className={`text-xs ${budget.status === "over" ? "text-veyra-danger" : budget.status === "warning" ? "text-veyra-warning" : "text-slate-600"}`}>{budget.percent}% · {statusLabel[budget.status]}</span>
                    <progress
                      max="100"
                      value={Math.min(budget.percent, 100)}
                      aria-label={`${budget.category} budget used: ${budget.percent}%, ${statusLabel[budget.status]}`}
                      data-status={budget.status}
                      className="budget-progress col-span-2 h-1.5 w-full"
                    >{budget.percent}%</progress>
                  </div>
                ))}
              </article>
              <article className={panel}>
                <h2 className="mb-3 text-sm font-bold">Recent Transactions</h2>
                {summary.recentTransactions.length ? (
                  <>
                    <div className="overview-recent-desktop hidden md:block overflow-x-auto"><table className="w-full text-left text-xs">
                      <thead className="text-slate-500"><tr><th scope="col" className="p-1.5">Date</th><th scope="col" className="p-1.5">Merchant</th><th scope="col" className="p-1.5">Category</th><th scope="col" className="p-1.5 text-right">Amount</th></tr></thead>
                      <tbody>{summary.recentTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-veyra-line">
                        <td className="p-1.5"><time dateTime={transaction.date}>{transactionDate.format(new Date(`${transaction.date}T00:00:00Z`))}</time></td><td className="p-1.5">{transaction.merchant ?? "Unknown merchant"}</td><td className="p-1.5">{transaction.category ?? "Uncategorized"}</td>
                        <td className={`p-1.5 text-right ${transaction.type === "income" ? "text-veyra-success" : ""}`}>{transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}</td>
                      </tr>)}</tbody>
                    </table></div>
                    <ul className="overview-recent-mobile divide-y divide-veyra-line md:hidden" aria-label="Recent transactions">
                      {summary.recentTransactions.map((transaction) => (
                        <li key={transaction.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3">
                          <strong className="min-w-0 break-words text-sm">{transaction.merchant ?? "Unknown merchant"}</strong>
                          <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === "income" ? "text-veyra-success" : ""}`}>
                            {transaction.type === "income" ? "+" : "−"}{formatIdr(transaction.amount)}
                          </span>
                          <span className="mt-1 text-xs text-slate-500">
                            <time dateTime={transaction.date}>{transactionDate.format(new Date(`${transaction.date}T00:00:00Z`))}</time>
                            {` · ${transaction.category ?? "Uncategorized"}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : <p className="text-sm">No transactions for this period.</p>}
              </article>
            </section>

            <section className="mt-2.5">
              <article id="veyra-insight" className={`${panel} relative min-h-40 overflow-hidden`}>
                <picture aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[48%] max-w-[280px]">
                  <source srcSet="/assets/veyra-dashboard-portrait.webp" type="image/webp" />
                  <Image src="/assets/veyra-dashboard-portrait.png" alt="" fill sizes="280px" className="origin-top-right scale-[2] object-contain object-right-top" preload />
                </picture>
                <div className="max-w-[52%]">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Sparkle size={16} weight="duotone" aria-hidden="true" />Veyra</h2>
                  <p className="text-sm">{summary.hasTransactions ? insight : "No transactions for this period."}</p>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
