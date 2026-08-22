const skeleton = "animate-pulse rounded-veyra bg-slate-200 motion-reduce:animate-none";

export default function Loading() {
  return (
    <div aria-busy="true" className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
      <aside className="border-b border-veyra-line bg-white p-6 xl:min-h-dvh xl:border-b-0 xl:border-r">
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-8 h-10 rounded-lg bg-sky-50" />
      </aside>
      <main className="p-4">
        <span role="status" aria-live="polite" className="sr-only">Loading pockets…</span>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-veyra-line pb-4">
          <div>
            <div className="h-8 w-28 rounded bg-slate-200" />
            <div className="mt-2 h-5 w-72 max-w-full rounded bg-slate-200" />
          </div>
          <div className={`${skeleton} h-10 w-28`} />
        </header>
        <section aria-label="Loading pocket list" className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-veyra border border-veyra-line bg-white p-4">
              <div className={`${skeleton} h-5 w-40`} />
              <div className={`${skeleton} mt-3 h-4 w-28`} />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
