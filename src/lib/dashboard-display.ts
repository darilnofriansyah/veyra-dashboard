type TrendPoint = { date: string; amount: number };

export function comparison(current: number, previous: number, lowerIsBetter: boolean) {
  if (!previous) return { text: "No comparison", className: "text-slate-500" };

  const delta = current - previous;
  if (!delta) return { text: "No change vs previous period", className: "text-slate-500" };

  const percent = Math.round((delta / previous) * 100);
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return {
    text: `${delta < 0 ? "↓ Down" : "↑ Up"} ${Math.abs(percent)}% vs previous period`,
    className: improved ? "text-veyra-success" : "text-veyra-danger"
  };
}

export function trendLayout(
  points: TrendPoint[],
  start: string,
  exclusiveEnd: string,
  width: number,
  height: number
) {
  const peak = Math.max(...points.map((point) => point.amount));
  const plotMaximum = Math.max(peak, 1);
  const bounds = { left: 92, right: width - 12, top: 12, bottom: height - 32 };
  const plotWidth = bounds.right - bounds.left;
  const plotHeight = bounds.bottom - bounds.top;
  const day = 86_400_000;
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const periodDays = (Date.parse(`${exclusiveEnd}T00:00:00Z`) - startTime) / day;

  return {
    peak,
    bounds,
    coordinates: points.map((point) => ({
      ...point,
      x: bounds.left
        + ((Date.parse(`${point.date}T00:00:00Z`) - startTime) / day)
        / Math.max(periodDays - 1, 1)
        * plotWidth,
      y: bounds.bottom - (point.amount / plotMaximum) * plotHeight
    }))
  };
}
