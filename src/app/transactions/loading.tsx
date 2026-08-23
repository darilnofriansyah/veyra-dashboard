const skeleton = "animate-pulse rounded-veyra bg-slate-200 motion-reduce:animate-none";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading transactions…"
      className="app-shell min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]"
    >
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
        <header className="mb-6">
          <div className="h-8 w-40 rounded bg-slate-200" />
          <div className="mt-2 h-5 w-72 max-w-full rounded bg-slate-200" />
        </header>
        <span role="status" aria-live="polite" className="sr-only">Loading transactions…</span>
        <section aria-label="Transaction filters" className="rounded-veyra border border-veyra-line bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1.5fr_auto] xl:items-end">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={`${skeleton} h-10`} />
            ))}
          </div>
        </section>
        <section className="mt-4 hidden md:block overflow-x-auto rounded-veyra border border-veyra-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">Finalized transaction records</caption>
            <thead className="border-b border-veyra-line bg-slate-50">
              <tr>{Array.from({ length: 7 }, (_, index) => <th key={index} className="px-4 py-4"><div className={`${skeleton} h-3 w-16`} /></th>)}</tr>
            </thead>
            <tbody className="divide-y divide-veyra-line">
              {Array.from({ length: 8 }, (_, index) => (
                <tr key={index}>
                  {Array.from({ length: 7 }, (_, column) => <td key={column} className="px-4 py-4"><div className={`${skeleton} h-4 ${column === 5 ? "ml-auto w-20" : "w-24"}`} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <ul className="transactions-mobile-skeleton divide-y divide-veyra-line rounded-veyra border border-veyra-line bg-white md:hidden" aria-label="Loading transaction records">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-4">
              <div className={`${skeleton} h-4 w-40 max-w-full`} />
              <div className={`${skeleton} ml-auto h-4 w-24`} />
              <div className={`${skeleton} h-3 w-56 max-w-full`} />
              <div className={`${skeleton} h-10 w-16`} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
