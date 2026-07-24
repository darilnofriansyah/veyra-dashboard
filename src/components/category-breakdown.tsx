import { formatIdr, type OverviewSummary } from "@/lib/finance";

const colors = ["#00B3FF", "#3C91E6", "#A64DFF", "#6D79D8", "#8CCFF1", "#CBD5E1"];

export function CategoryBreakdown({ categories }: { categories: OverviewSummary["categories"] }) {
  if (!categories.length) return <p className="text-sm">No transactions for this month.</p>;
  let cursor = 0;
  const stops = categories.map((category, index) => {
    const start = cursor;
    cursor += category.percent;
    return `${colors[index]} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[140px_1fr]">
      <div className="relative mx-auto size-36 rounded-full after:absolute after:inset-[28%] after:rounded-full after:bg-white" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label="Spending distribution by category" />
      <ul className="space-y-2">{categories.map((category, index) => (
        <li key={category.category} className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: colors[index] }} />
          <span>{category.category} {category.percent}%</span>
          <strong>{formatIdr(category.amount)}</strong>
        </li>
      ))}</ul>
    </div>
  );
}
