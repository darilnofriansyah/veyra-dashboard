import { OverviewDashboard } from "@/components/overview-dashboard";
import { loadOverview, type DemoState } from "@/lib/overview-loader";
import { connection } from "next/server";

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const requestedState = Array.isArray(params.state) ? params.state[0] : params.state;
  const demoState = process.env.NODE_ENV === "development"
    && ["empty", "budget-error", "transaction-error", "error"].includes(requestedState ?? "")
    ? requestedState as DemoState
    : null;
  const now = jakartaToday();
  const data = await loadOverview(now, demoState);

  return <OverviewDashboard now={now} data={data} />;
}
