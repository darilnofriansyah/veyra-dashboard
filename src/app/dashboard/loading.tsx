const skeleton = "animate-pulse rounded-veyra border border-veyra-line bg-white motion-reduce:animate-none";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading overview…" className="app-shell min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
      <header className="app-mobile-header flex min-w-0 items-center justify-between gap-3 border-b border-veyra-line bg-white px-4 py-3 xl:hidden" aria-hidden="true">
        <div className={`${skeleton} h-7 w-28`} />
        <div className={`${skeleton} size-9 rounded-full`} />
      </header>
      <aside className="app-sidebar flex flex-wrap items-center gap-4 border-b border-veyra-line bg-white p-4 xl:block xl:min-h-dvh xl:border-b-0 xl:border-r xl:p-6">
        <div className={`${skeleton} app-brand hidden h-7 w-32 xl:block`} aria-hidden="true" />
        <nav aria-label="Loading primary navigation" className="app-nav order-2 grid basis-full gap-1 sm:grid-cols-3 xl:mt-8 xl:grid-cols-1" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className={`${skeleton} h-14 xl:h-10`} />)}
        </nav>
        <div className="app-account order-1 ml-auto hidden min-w-0 items-center gap-3 xl:fixed xl:bottom-6 xl:left-6 xl:ml-0 xl:flex xl:w-[168px]" aria-hidden="true">
          <div className={`${skeleton} size-9 shrink-0 rounded-full`} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`${skeleton} h-4 w-24`} />
            <div className={`${skeleton} h-3 w-20`} />
          </div>
        </div>
      </aside>
      <main className="p-4">
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
          <div><h1 className="text-2xl font-bold">Overview</h1><p className="mt-1 text-sm text-slate-500">Here’s your financial summary.</p></div>
          <div className="h-9 w-28 rounded-lg bg-white" />
        </header>
        <span role="status" aria-live="polite" className="sr-only">Loading overview…</span>
        <section aria-label="Loading financial pulse" className={`${skeleton} grid min-h-[207px] gap-5 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]`}>
          <div className="space-y-4">
            <div className="h-4 w-full max-w-28 rounded bg-slate-200"><span className="sr-only">Net Cashflow</span></div>
            <div className="h-9 w-full max-w-48 rounded bg-slate-200" />
            <div className="h-3 w-full max-w-36 rounded bg-slate-200" />
            <div className="mt-5 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
              <div className="min-w-0 space-y-2">
                <span className="sr-only">Total Income</span>
                <div className="h-3 w-full max-w-24 rounded bg-slate-200" />
                <div className="h-6 w-full max-w-28 rounded bg-slate-200" />
                <div className="h-3 w-full max-w-20 rounded bg-slate-200" />
              </div>
              <div className="min-w-0 space-y-2">
                <span className="sr-only">Total Spent</span>
                <div className="h-3 w-full max-w-24 rounded bg-slate-200" />
                <div className="h-6 w-full max-w-28 rounded bg-slate-200" />
                <div className="h-3 w-full max-w-20 rounded bg-slate-200" />
              </div>
            </div>
            <div className="mt-4 border-t border-veyra-line pt-3">
              <span className="sr-only">Daily Average Spend</span>
              <div className="h-3 w-full max-w-32 rounded bg-slate-200" />
              <div className="mt-1 h-6 w-full max-w-28 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full max-w-20 rounded bg-slate-200" />
            </div>
          </div>
          <div className="space-y-4 border-t border-veyra-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="h-4 w-full max-w-24 rounded bg-slate-200"><span className="sr-only">Credit Card</span></div>
            <div className="h-3 w-full max-w-28 rounded bg-slate-200"><span className="sr-only">Amount to Pay</span></div>
            <div className="h-7 w-full max-w-40 rounded bg-slate-200" />
            <div className="h-3 w-full max-w-28 rounded bg-slate-200"><span className="sr-only">Credit Used</span></div>
            <div className="h-7 w-full max-w-32 rounded bg-slate-200" />
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-3 w-full max-w-40 rounded bg-slate-200"><span className="sr-only">Credit Limit</span></div>
          </div>
        </section>
        <div className={`${skeleton} mt-2.5 h-24`} aria-label="Loading latest alert" />
        <section className="mt-2.5 grid gap-2.5 xl:grid-cols-[1.6fr_1fr]">
          <div className={`${skeleton} h-[207px]`} /><div className={`${skeleton} h-[207px]`} />
        </section>
        <section className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
          <div className={`${skeleton} h-[206px]`} /><div className={`${skeleton} h-[206px]`} />
        </section>
        <section className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
          <div className={`${skeleton} h-40`} /><div className={`${skeleton} h-40`} />
        </section>
      </main>
    </div>
  );
}
