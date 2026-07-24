"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { createFixtureData } from "@/lib/fixtures";
import { formatIdr, summarizeOverview, type Period } from "@/lib/finance";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function OverviewDashboard() {
  const [period, setPeriod] = useState<Period>("current");
  const now = useMemo(jakartaToday, []);
  const fixture = useMemo(() => createFixtureData(now), [now]);
  const summary = useMemo(
    () => summarizeOverview({ ...fixture, period, now }),
    [fixture, period, now]
  );

  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-veyra-ink">
      <label>
        Period
        <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
          <option value="current">This Month</option>
          <option value="previous">Last Month</option>
        </select>
      </label>
      <output className="sr-only" aria-live="polite">{period === "current" ? "This Month" : "Last Month"} selected.</output>
      <span>{formatIdr(summary.netCashflow)}</span>
      <Image src="/assets/veyra-logo.png" width={124} height={32} alt="Veyra" priority />
    </div>
  );
}
