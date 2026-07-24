import { formatIdr, type OverviewSummary } from "@/lib/finance";

export function SpendingTrend({ points }: { points: OverviewSummary["dailySpend"] }) {
  if (!points.length) return <p className="text-sm">No transactions for this month.</p>;
  const width = 600;
  const height = 220;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - (point.amount / max) * (height - 20)
  }));

  return (
    <>
      <svg className="h-[220px] w-full text-veyra-cyan" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily spending peaks at ${formatIdr(max)}.`}>
        <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {coordinates.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="7" tabIndex={0} role="img" aria-label={`${point.date}: ${formatIdr(point.amount)}`} className="fill-white stroke-veyra-cyan stroke-[4] focus:stroke-veyra-navy" />
        ))}
      </svg>
      <ul className="sr-only">{points.map((point) => <li key={point.date}>{point.date}: {formatIdr(point.amount)}</li>)}</ul>
    </>
  );
}
