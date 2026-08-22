"use client";

import { House, Receipt, Wallet } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions";

type ActivePage = "overview" | "transactions" | "pockets";

interface AppShellProps {
  activePage: ActivePage;
  viewerName: string | null;
  accountContext: string;
  mainId: string;
  skipLabel: string;
  children: ReactNode;
}

const activeLink = "flex items-center gap-2 rounded-lg border-l-[3px] border-veyra-cyan bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700 transition-colors motion-reduce:transition-none";
const inactiveLink = "flex items-center gap-2 rounded-lg border-l-[3px] border-transparent px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-veyra-line hover:bg-slate-50 hover:text-veyra-ink motion-reduce:transition-none";

export function AppShell({
  activePage,
  viewerName,
  accountContext,
  mainId,
  skipLabel,
  children
}: AppShellProps) {
  const accountName = viewerName ?? "Telegram user";
  const initials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-veyra-ink xl:grid xl:grid-cols-[216px_1fr]">
      <a href={`#${mainId}`} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-veyra-navy focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white">{skipLabel}</a>
      <aside className="flex flex-wrap items-center gap-4 border-b border-veyra-line bg-white p-4 xl:block xl:min-h-dvh xl:border-b-0 xl:border-r xl:p-6">
        <Image src="/assets/veyra-logo.png" width={840} height={194} sizes="124px" alt="Veyra" className="h-auto w-[124px]" preload />
        <nav aria-label="Primary" className="order-2 grid basis-full gap-1 xl:mt-8">
          <Link
            href="/dashboard"
            aria-current={activePage === "overview" ? "page" : undefined}
            className={activePage === "overview" ? activeLink : inactiveLink}
          >
            <House size={16} weight="duotone" aria-hidden="true" />
            Overview
          </Link>
          <Link
            href="/transactions"
            aria-current={activePage === "transactions" ? "page" : undefined}
            className={activePage === "transactions" ? activeLink : inactiveLink}
          >
            <Receipt size={16} weight="duotone" aria-hidden="true" />
            Transactions
          </Link>
          <Link
            href="/pockets"
            aria-current={activePage === "pockets" ? "page" : undefined}
            className={activePage === "pockets" ? activeLink : inactiveLink}
          >
            <Wallet size={16} weight="duotone" aria-hidden="true" />
            Pockets
          </Link>
        </nav>
        <section aria-label="Current account" className="order-1 ml-auto flex min-w-0 items-center gap-3 xl:fixed xl:bottom-6 xl:left-6 xl:ml-0 xl:w-[168px]">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-veyra-navy text-xs font-semibold text-white">{initials}</span>
          <div className="min-w-0 flex-1">
            <strong className="block min-w-0 break-words text-sm">{accountName}</strong>
            <span className="block min-w-0 break-words text-xs text-slate-500">{accountContext}</span>
            <form action={logout}>
              <button
                type="submit"
                className="mt-1 block text-xs font-semibold text-sky-700 transition-colors hover:text-veyra-navy motion-reduce:transition-none"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>
      </aside>

      <main id={mainId} className="p-4">{children}</main>
    </div>
  );
}
