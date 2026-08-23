const skeleton = "animate-pulse rounded-veyra bg-slate-200 motion-reduce:animate-none";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading pockets…" className="app-shell min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
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
        <span role="status" aria-live="polite" className="sr-only">Loading pockets…</span>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-veyra-line pb-4">
          <div>
            <div className="h-8 w-28 rounded bg-slate-200" />
            <div className="mt-2 h-5 w-72 max-w-full rounded bg-slate-200" />
          </div>
          <div className={`${skeleton} h-10 w-full sm:w-28`} />
        </header>
        <section aria-label="Loading pocket list" className="pocket-list-skeleton divide-y divide-veyra-line overflow-hidden rounded-veyra border border-veyra-line bg-white">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className={`${skeleton} h-5 w-40 max-w-full`} />
                <div className={`${skeleton} mt-3 h-4 w-28 max-w-full`} />
              </div>
              <div className="grid w-full gap-2 sm:flex sm:w-auto">
                <div className={`${skeleton} h-10 w-full sm:w-20`} />
                <div className={`${skeleton} h-10 w-full sm:w-24`} />
                <div className={`${skeleton} h-10 w-full sm:w-28`} />
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
