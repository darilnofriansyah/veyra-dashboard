import { ArrowLeft } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { formatIdr } from "@/lib/finance";
import { loadPocketStatus } from "@/lib/pockets-api";

export const metadata: Metadata = {
  title: "Pocket Detail",
  description: "Review one Veyra pocket’s current budget status"
};

const cycleDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default async function Page({ params }: { params: Promise<{ pocketId: string }> }) {
  await connection();
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const { pocketId } = await params;
  const status = await loadPocketStatus(session.telegramUserId, pocketId, jakartaToday());
  if (!status) redirect("/dashboard");

  const cycleEnd = new Date(`${status.cycle_end}T00:00:00Z`);
  cycleEnd.setUTCDate(cycleEnd.getUTCDate() - 1);
  const cycle = `${cycleDate.format(new Date(`${status.cycle_start}T00:00:00Z`))}–${cycleDate.format(cycleEnd)}`;
  const remainingLabel = status.remaining_amount < 0 ? "Over Budget" : "Remaining";

  return (
    <AppShell activePage="pockets" viewerName={session.name} accountContext={cycle} mainId="pocket-detail" skipLabel="Skip to pocket detail">
      <div className="mx-auto max-w-[960px] space-y-4 xl:px-2 xl:py-1">
        <Link href="/pockets" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-sky-700 transition-colors hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.98] motion-reduce:transition-none">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Pockets
        </Link>

        <header className="border-b border-veyra-line pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Current Cycle</p>
          <h1 className="mt-1 break-words text-pretty text-3xl font-bold tracking-[-0.04em] text-veyra-ink">{status.category}</h1>
          <p className="mt-1 text-sm text-slate-600">{cycle}</p>
        </header>

        <section aria-labelledby="pocket-status-title" className="rounded-veyra border border-veyra-line bg-white p-5">
          <h2 id="pocket-status-title" className="text-lg font-bold">Budget Status</h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-3">
            <div><dt className="text-xs font-medium text-slate-500">Spent</dt><dd className="mt-1 text-xl font-bold tabular-nums">{formatIdr(status.spent_amount)}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Monthly Budget</dt><dd className="mt-1 text-xl font-bold tabular-nums">{formatIdr(status.budget_amount)}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">{remainingLabel}</dt><dd className={`mt-1 text-xl font-bold tabular-nums ${status.remaining_amount < 0 ? "text-veyra-danger" : "text-veyra-ink"}`}>{formatIdr(Math.abs(status.remaining_amount))}</dd></div>
          </dl>
          <progress max="100" value={Math.min(status.spent_percent, 100)} aria-label={`${status.category} budget used: ${status.spent_percent}%`} className="budget-progress mt-5 h-2 w-full">{status.spent_percent}%</progress>
          <p className="mt-2 text-sm text-slate-600"><span className="tabular-nums">{status.spent_percent}%</span> of the monthly budget used.</p>
        </section>

        <section aria-labelledby="pocket-breakdown-title" className="rounded-veyra border border-veyra-line bg-white p-5">
          <h2 id="pocket-breakdown-title" className="text-lg font-bold">Category Breakdown</h2>
          {status.child_breakdown.length > 0 ? (
            <ul className="mt-3 divide-y divide-veyra-line">
              {status.child_breakdown.map((child) => (
                <li key={child.budget_id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0"><h3 className="break-words font-semibold">{child.category}</h3><p className="mt-1 text-sm text-slate-600">{child.spent_percent}% used</p></div>
                  <p className="text-sm font-semibold tabular-nums">{formatIdr(child.spent_amount)} / {formatIdr(child.budget_amount)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-600">No category budgets are attached to this pocket.</p>}
        </section>
      </div>
    </AppShell>
  );
}
