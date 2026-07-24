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

export function trendLayout(points: TrendPoint[], width: number, height: number) {
  const peak = Math.max(...points.map((point) => point.amount));
  const plotMaximum = Math.max(peak, 1);
  const bounds = { left: 92, right: width - 12, top: 12, bottom: height - 32 };
  const plotWidth = bounds.right - bounds.left;
  const plotHeight = bounds.bottom - bounds.top;
  const [year, month] = points[0].date.slice(0, 7).split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    peak,
    bounds,
    coordinates: points.map((point) => ({
      ...point,
      x: bounds.left + ((Number(point.date.slice(-2)) - 1) / (daysInMonth - 1)) * plotWidth,
      y: bounds.bottom - (point.amount / plotMaximum) * plotHeight
    }))
  };
}
