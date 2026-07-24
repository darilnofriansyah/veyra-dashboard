const skeleton = "animate-pulse rounded-veyra border border-veyra-line bg-white motion-reduce:animate-none";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading overview…" className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
      <aside className="border-b border-veyra-line bg-white p-6 xl:min-h-dvh xl:border-b-0 xl:border-r">
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-8 h-10 rounded-lg bg-sky-50" />
      </aside>
      <main className="p-4">
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
          <div><h1 className="text-2xl font-bold">Overview</h1><p className="mt-1 text-sm text-slate-500">Here’s your financial summary.</p></div>
          <div className="h-9 w-28 rounded-lg bg-white" />
        </header>
        <span className="sr-only">Loading overview…</span>
        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className={`${skeleton} h-[89px]`} />)}
        </section>
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
