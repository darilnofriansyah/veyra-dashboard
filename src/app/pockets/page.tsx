import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PocketsPage } from "@/components/pockets-page";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { loadPockets } from "@/lib/pockets-api";

export const metadata: Metadata = {
  title: "Pockets",
  description: "Manage your Veyra pockets and monthly budgets"
};

export default async function Page() {
  await connection();
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) redirect("/");

  const result = await loadPockets(session.telegramUserId);
  return <PocketsPage result={result} viewerName={session.name} />;
}
