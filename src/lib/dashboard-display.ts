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
  const plotHeight = height - 40;

  return {
    peak,
    coordinates: points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
      y: height - 20 - (point.amount / plotMaximum) * plotHeight
    }))
  };
}
