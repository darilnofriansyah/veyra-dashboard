const skeleton = "animate-pulse rounded-veyra bg-slate-200 motion-reduce:animate-none";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading transactions…"
      className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]"
    >
      <aside className="border-b border-veyra-line bg-white p-6 xl:min-h-dvh xl:border-b-0 xl:border-r">
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-8 h-10 rounded-lg bg-sky-50" />
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
        <section className="mt-4 overflow-x-auto rounded-veyra border border-veyra-line bg-white">
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
      </main>
    </div>
  );
}
