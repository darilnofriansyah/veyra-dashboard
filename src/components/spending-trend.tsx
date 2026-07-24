import { formatIdr, type OverviewSummary } from "@/lib/finance";
import { trendLayout } from "@/lib/dashboard-display";

const compactIdr = new Intl.NumberFormat("en-ID", { notation: "compact", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

export function SpendingTrend({ points }: { points: OverviewSummary["dailySpend"] }) {
  if (!points.length) return <p className="text-sm">No transactions for this month.</p>;
  const width = 600;
  const height = 160;
  const { peak, bounds, coordinates } = trendLayout(points, width, height);
  const ticks = [1, 0.5, 0];
  const labelPoints = [...new Set([0, Math.floor((coordinates.length - 1) / 2), coordinates.length - 1])]
    .map((index) => coordinates[index]);

  return (
    <>
      <svg className="h-40 w-full text-veyra-cyan" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily spending peaks at ${formatIdr(peak)}.`}>
        {ticks.map((ratio) => {
          const y = bounds.bottom - ratio * (bounds.bottom - bounds.top);
          return (
            <g key={ratio}>
              <line x1={bounds.left} x2={bounds.right} y1={y} y2={y} className="stroke-slate-200" strokeDasharray="3 4" />
              <text x={bounds.left - 8} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px]">
                {ratio ? `IDR ${compactIdr.format(peak * ratio)}` : "IDR 0"}
              </text>
            </g>
          );
        })}
        <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        {coordinates.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="24" tabIndex={0} role="img" aria-label={`${point.date}: ${formatIdr(point.amount)}`} className="peer fill-transparent stroke-transparent focus:stroke-veyra-navy focus:stroke-2" />
            <circle cx={point.x} cy={point.y} r="6" aria-hidden="true" className="pointer-events-none fill-white stroke-veyra-cyan stroke-[3]" />
            <g role="tooltip" aria-hidden="true" className="pointer-events-none opacity-0 transition-opacity peer-hover:opacity-100 peer-focus:opacity-100 motion-reduce:transition-none">
              <rect x={Math.min(Math.max(point.x - 92, bounds.left), width - 188)} y={point.y < 50 ? point.y + 10 : point.y - 38} width="184" height="30" rx="6" className="fill-veyra-navy" />
              <text x={Math.min(Math.max(point.x, bounds.left + 92), width - 96)} y={point.y < 50 ? point.y + 29 : point.y - 19} textAnchor="middle" className="fill-white text-[11px]">
                {shortDate.format(new Date(`${point.date}T00:00:00Z`))} · {formatIdr(point.amount)}
              </text>
            </g>
          </g>
        ))}
        {labelPoints.map((point) => (
          <text key={point.date} x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
            {shortDate.format(new Date(`${point.date}T00:00:00Z`))}
          </text>
        ))}
      </svg>
      <ul className="sr-only">{points.map((point) => <li key={point.date}>{point.date}: {formatIdr(point.amount)}</li>)}</ul>
    </>
  );
}
