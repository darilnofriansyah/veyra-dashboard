import { OverviewDashboard } from "@/components/overview-dashboard";
import { loadOverview } from "@/lib/overview-loader";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your Veyra financial overview"
};

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default async function Page() {
  await connection();
  const asOfDate = jakartaToday();
  const data = await loadOverview(asOfDate);

  return <OverviewDashboard data={data} />;
}
