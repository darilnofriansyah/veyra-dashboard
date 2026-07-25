import { OverviewDashboard } from "@/components/overview-dashboard";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { loadOverview } from "@/lib/overview-loader";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) redirect("/");

  const asOfDate = jakartaToday();
  const data = await loadOverview(asOfDate, session.telegramUserId);

  return <OverviewDashboard data={data} viewerName={session.name} />;
}
