import { formatIdr, type OverviewSummary } from "@/lib/finance";

const colors = ["#00B3FF", "#3C91E6", "#A64DFF", "#6D79D8", "#8CCFF1", "#CBD5E1"];
export function CategoryBreakdown({ categories }: { categories: OverviewSummary["categories"] }) {
  if (!categories.length) return <p className="text-sm">No transactions for this period.</p>;
  const total = categories.reduce((sum, category) => sum + category.amount, 0);
  let cursor = 0;
  const stops = categories.map((category, index) => {
    const start = cursor;
    cursor += category.percent;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="grid items-center gap-3 sm:grid-cols-[128px_1fr]">
      <div className="relative mx-auto grid size-32 place-items-center rounded-full" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label={`Spending distribution totaling ${formatIdr(total)}`}>
        <span aria-hidden="true" className="z-10 grid size-[60%] place-content-center rounded-full bg-white px-1 text-center leading-tight text-veyra-ink">
          <span className="block text-[8px] text-slate-500">IDR</span><strong className="block text-[11px] tracking-[-0.05em]">{formatIdr(total).replace("IDR ", "")}</strong>
        </span>
      </div>
      <ul className="space-y-1.5">{categories.map((category, index) => (
        <li key={category.category} className="grid grid-cols-[8px_minmax(0,1fr)] items-center gap-x-2 text-xs sm:grid-cols-[8px_minmax(0,1fr)_auto]">
          <span className="size-2 rounded-full" style={{ background: colors[index % colors.length] }} />
          <span>{category.category} {category.percent}%</span>
          <strong className="col-start-2 sm:col-auto">{formatIdr(category.amount)}</strong>
        </li>
      ))}</ul>
    </div>
  );
}
