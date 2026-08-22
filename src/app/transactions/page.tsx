import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TransactionsPage } from "@/components/transactions-page";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { loadPockets } from "@/lib/pockets-api";
import { parseTransactionFilters } from "@/lib/transaction-filters";
import { loadTransactions } from "@/lib/transactions-api";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Review and correct your Veyra transactions"
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default async function Page({ searchParams }: PageProps) {
  await connection();
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) redirect("/");

  const filters = parseTransactionFilters(await searchParams);
  const [result, pocketResult] = await Promise.all([
    loadTransactions({
      telegramUserId: session.telegramUserId,
      asOfDate: jakartaToday(),
      filters
    }),
    loadPockets(session.telegramUserId)
  ]);

  return (
    <TransactionsPage
      result={result}
      pockets={pocketResult.pockets}
      pocketsUnavailable={pocketResult.error}
      filters={filters}
      viewerName={session.name}
    />
  );
}
