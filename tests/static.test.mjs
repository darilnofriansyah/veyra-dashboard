import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(path, "utf8").catch(() => "");

test("shares one safe mobile navigation across browser and Telegram", async () => {
  const [shell, css] = await Promise.all([
    readSource("src/components/app-shell.tsx"),
    readSource("src/app/globals.css")
  ]);

  assert.match(shell, /app-mobile-header/);
  assert.match(shell, /app-sidebar/);
  assert.match(shell, /app-nav/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.app-shell[\s\S]*padding-bottom:/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /\.app-sidebar[\s\S]*position:\s*fixed/);
  assert.match(css, /\.app-nav[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.doesNotMatch(css, /transition:\s*all/);
});

test("keeps shared shell icons safe for server route collection", async () => {
  const shell = await readSource("src/components/app-shell.tsx");

  assert.match(shell, /from "@phosphor-icons\/react\/ssr"/);
  assert.doesNotMatch(shell, /from "@phosphor-icons\/react";/);
});

test("reserves room for wrapped mobile navigation labels", async () => {
  const css = await readSource("src/app/globals.css");

  assert.match(css, /\.app-shell[\s\S]*padding-bottom:\s*calc\(7rem \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /html\[data-telegram-mini-app="true"\] \.app-shell[\s\S]*padding-bottom:\s*calc\(7rem \+ var\(--veyra-telegram-safe-bottom\)\)/);
});

test("keeps responsive shell structure in every loading route", async () => {
  const loadingRoutes = await Promise.all([
    readSource("src/app/dashboard/loading.tsx"),
    readSource("src/app/transactions/loading.tsx"),
    readSource("src/app/pockets/loading.tsx")
  ]);

  for (const loading of loadingRoutes) {
    assert.match(loading, /app-shell/);
    assert.match(loading, /app-mobile-header/);
    assert.match(loading, /app-sidebar/);
    assert.match(loading, /app-nav/);
    assert.match(loading, /xl:grid-cols-\[216px_1fr\]/);
    assert.match(loading, /aria-busy="true"/);
    assert.match(loading, /role="status" aria-live="polite"/);
  }
});

test("uses App Router, Tailwind v4, and no unfinished dashboard destinations", async () => {
  const [page, dashboard, css, postcss] = await Promise.all([
    readFile("src/app/dashboard/page.tsx", "utf8"),
    readFile("src/components/overview-dashboard.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
    readFile("postcss.config.mjs", "utf8")
  ]);
  assert.match(page, /OverviewDashboard/);
  assert.match(dashboard, /"use client"/);
  assert.match(dashboard, /Current Cycle/);
  assert.match(dashboard, /Previous Cycle/);
  assert.doesNotMatch(dashboard, /This Month|Last Month/);
  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme/);
  assert.match(postcss, /@tailwindcss\/postcss/);
  for (const destination of ["Analytics", "Goals", "Reports", "Settings", "View All"]) {
    assert.doesNotMatch(dashboard, new RegExp(`>${destination}<`));
  }
});

test("loads one server-side Nexus Core overview and passes it to the client", async () => {
  const [page, dashboard, loader] = await Promise.all([
    readSource("src/app/dashboard/page.tsx"),
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/overview-loader.ts")
  ]);

  assert.match(page, /await connection\(\)/);
  assert.match(page, /function jakartaToday\(\)/);
  assert.match(page, /verifySessionToken/);
  assert.match(page, /await loadOverview\(asOfDate, session\.telegramUserId\)/);
  assert.match(page, /<OverviewDashboard data=\{data\} viewerName=\{session\.name\}/);
  assert.match(loader, /\/api\/veyra\/dashboard\/overview/);
  assert.match(loader, /cache:\s*"no-store"/);
  assert.match(loader, /AbortSignal\.timeout\(5_000\)/);
  assert.doesNotMatch(`${page}\n${dashboard}`, /useSearchParams|DemoState|requestedState/);
  assert.doesNotMatch(loader, /createFixtureTransactions|createFixtureBudgets/);
});

test("keeps Core API credentials and identity server-only", async () => {
  const [loader, dashboard] = await Promise.all([
    readSource("src/lib/overview-loader.ts"),
    readSource("src/components/overview-dashboard.tsx")
  ]);

  assert.match(loader, /process\.env\.CORE_API_KEY/);
  assert.match(loader, /"x-core-api-key"/);
  assert.doesNotMatch(loader, /VEYRA_TELEGRAM_USER_ID|VEYRA_USER_ID/);
  assert.doesNotMatch(`${loader}\n${dashboard}`, /NEXT_PUBLIC_/);
  assert.doesNotMatch(dashboard, /CORE_API_KEY|NEXUS_CORE_URL|fetch\(/);
});

test("composes the approved dashboard hierarchy", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  for (const section of [
    "Financial pulse",
    "Spending Trend",
    "Spending by Category",
    "Budget Status",
    "Recent Transactions",
    "Needs Attention",
    "Veyra"
  ]) {
    assert.match(dashboard, new RegExp(section));
  }
  assert.match(dashboard, /Current Cycle/);
  assert.match(dashboard, /Previous Cycle/);
  assert.doesNotMatch(dashboard, /This Month|Last Month/);
  assert.equal([...dashboard.matchAll(/useState(?:<[^>]+>)?\(/g)].length, 1);
  assert.match(dashboard, /useState<Period>\(/);
  assert.match(dashboard, /motion-reduce:transition-none/);
});

test("renders one period-owned accessible credit card summary", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label="Credit card"/);
  assert.match(dashboard, /Amount to Pay/);
  assert.match(dashboard, /Credit Used/);
  assert.match(dashboard, /summary\.creditCard\.statementBalance/);
  assert.match(dashboard, /summary\.creditCard\.used/);
  assert.match(dashboard, /summary\.creditCard\.limit/);
  assert.match(dashboard, /aria-label=\{`Credit card used:/);
  assert.match(
    dashboard,
    /className="mt-1 block text-2xl[^"]*">\{formatIdr\(summary\.creditCard\.statementBalance\)\}<\/strong>/
  );
  assert.equal([...dashboard.matchAll(/aria-label="Credit card"/g)].length, 1);
  assert.ok(
    dashboard.indexOf('aria-label="Financial pulse"')
      < dashboard.indexOf('aria-label="Credit card"')
  );
});

test("prioritizes one responsive financial pulse", async () => {
  const [dashboard, categories, loading] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/components/category-breakdown.tsx"),
    readSource("src/app/dashboard/loading.tsx")
  ]);

  assert.equal([...dashboard.matchAll(/aria-label="Financial pulse"/g)].length, 1);
  assert.ok(dashboard.indexOf("Net Cashflow") < dashboard.indexOf("Total Income"));
  assert.ok(dashboard.indexOf("Needs Attention") < dashboard.indexOf("Financial pulse"));
  assert.match(dashboard, /overview-recent-mobile/);
  assert.match(dashboard, /overview-recent-desktop/);
  assert.doesNotMatch(categories, /#A64DFF|#6D79D8/);
  assert.doesNotMatch(await readSource("src/app/globals.css"), /veyra-purple/);
  assert.match(loading, /aria-label="Loading financial pulse"/);
});

test("keeps the loading pulse fluid and complete", async () => {
  const loading = await readSource("src/app/dashboard/loading.tsx");
  const pulse = loading.match(/<section aria-label="Loading financial pulse"[\s\S]*?<\/section>/)?.[0] ?? "";

  assert.match(pulse, /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,9rem\),1fr\)\)\]/);
  assert.doesNotMatch(pulse, /grid-cols-2/);
  for (const field of ["Net Cashflow", "Total Income", "Total Spent", "Daily Average Spend", "Amount to Pay", "Credit Used", "Credit Limit"]) {
    assert.match(pulse, new RegExp(field));
  }
});

test("uses raw budget status and current attention semantics", async () => {
  const [dashboard, finance] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/finance.ts")
  ]);

  assert.match(dashboard, /budget\.status/);
  assert.match(dashboard, /statusLabel\[budget\.status\]/);
  assert.match(dashboard, /\{budget\.percent\}% · \{statusLabel\[budget\.status\]\}/);
  assert.match(dashboard, /data\.data\?\.current\.attention/);
  assert.match(dashboard, /attentionPreview/);
  assert.match(dashboard, /item\.projectedOverrun/);
  assert.match(dashboard, /View all at-risk pockets/);
  assert.match(dashboard, /attention\.remaining\.map/);
  assert.match(dashboard, /href=\{`\/pockets\/\$\{item\.pocketId\}`\}/);
  assert.doesNotMatch(dashboard, /dismiss|resolve.*attention/i);
  assert.doesNotMatch(finance, /right\.percent\s*-\s*left\.percent/);
});

test("keeps both data visualizations accessible, data-driven, and fully labeled in IDR", async () => {
  const [trend, categories] = await Promise.all([
    readSource("src/components/spending-trend.tsx"),
    readSource("src/components/category-breakdown.tsx")
  ]);

  assert.match(trend, /role="img"/);
  assert.match(trend, /tabIndex=\{0\}/);
  assert.match(trend, /aria-label/);
  assert.match(trend, /role="tooltip"/);
  assert.match(trend, /className="sr-only"/);
  assert.match(trend, /formatIdr\(peak \* ratio\)/);
  assert.doesNotMatch(trend, /compactIdr|notation:\s*"compact"/);
  assert.match(trend, /No transactions for this period\./);
  assert.match(categories, /conic-gradient/);
  assert.match(categories, /role="img"/);
  assert.match(categories, /aria-label/);
  assert.match(categories, /formatIdr\(total\)/);
  assert.doesNotMatch(categories, /compactIdr|notation:\s*"compact"/);
  assert.match(categories, /No transactions for this period\./);
});

test("keeps every requested empty state period-neutral", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /summary\.hasTransactions \? insight : "No transactions for this period\."/);
  assert.doesNotMatch(dashboard, /No transactions for this month\./);
});

test("renders one aggregate retry state for a failed overview", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /data\.error \|\| !summary/);
  assert.match(dashboard, /Your financial summary couldn’t be loaded\./);
  assert.match(dashboard, /router\.refresh\(\)/);
  assert.doesNotMatch(dashboard, /transactionError|budgetError|guidanceError/);
});

test("names every budget progress bar", async () => {
  const dashboard = await readSource("src/components/overview-dashboard.tsx");

  assert.match(dashboard, /aria-label=\{`\$\{budget\.category\} budget used: \$\{budget\.percent\}%, \$\{statusLabel\[budget\.status\]\}`\}/);
});

test("keeps the loading header responsive and announces the pending overview", async () => {
  const loading = await readSource("src/app/dashboard/loading.tsx");

  assert.match(loading, /<header className="mb-2\.5 flex flex-wrap items-start justify-between gap-2\.5">/);
  assert.match(loading, /aria-label="Loading overview…"/);
  assert.match(loading, />Loading overview…<\/span>/);
});

test("offers keyboard users a skip link", async () => {
  const [dashboard, shell] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/components/app-shell.tsx")
  ]);

  assert.match(shell, /href=\{`#\$\{mainId\}`\}/);
  assert.match(shell, />\{skipLabel\}<\/a>/);
  assert.match(dashboard, /mainId="overview"/);
  assert.match(dashboard, /skipLabel="Skip to overview"/);
});

test("shares route-aware authenticated navigation across app pages", async () => {
  const [dashboard, shell] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/components/app-shell.tsx")
  ]);
  const overviewLinkStart = shell.indexOf('<Link\n            href="/dashboard"');
  const overviewLinkEnd = shell.indexOf("</Link>", overviewLinkStart);
  const transactionsLinkStart = shell.indexOf('<Link\n            href="/transactions"');
  const transactionsLinkEnd = shell.indexOf("</Link>", transactionsLinkStart);
  const overviewLink = shell.slice(overviewLinkStart, overviewLinkEnd);
  const transactionsLink = shell.slice(transactionsLinkStart, transactionsLinkEnd);

  assert.match(dashboard, /import \{ AppShell \} from "@\/components\/app-shell"/);
  assert.match(dashboard, /<AppShell[\s\S]*activePage="overview"/);
  assert.match(shell, /import Link from "next\/link"/);
  assert.ok(overviewLinkStart >= 0 && overviewLinkEnd > overviewLinkStart);
  assert.ok(transactionsLinkStart > overviewLinkEnd && transactionsLinkEnd > transactionsLinkStart);
  assert.match(overviewLink, /href="\/dashboard"/);
  assert.match(overviewLink, /\bOverview\b/);
  assert.match(overviewLink, /aria-current=\{activePage === "overview" \? "page" : undefined\}/);
  assert.match(overviewLink, /className=\{activePage === "overview" \? activeLink : inactiveLink\}/);
  assert.match(transactionsLink, /href="\/transactions"/);
  assert.match(transactionsLink, /\bTransactions\b/);
  assert.match(transactionsLink, /aria-current=\{activePage === "transactions" \? "page" : undefined\}/);
  assert.match(transactionsLink, /className=\{activePage === "transactions" \? activeLink : inactiveLink\}/);
  assert.match(shell, /const activeLink = "[^"]*border-veyra-cyan[^"]*bg-sky-50[^"]*text-sky-700/);
});

test("contains long account details inside the desktop sidebar", async () => {
  const shell = await readSource("src/components/app-shell.tsx");

  assert.match(shell, /aria-label="Current account"[^>]+xl:left-6[^>]+xl:w-\[168px\]/);
  assert.match(shell, /<strong className="[^"]*min-w-0[^"]*break-words[^"]*">\{accountName\}<\/strong>/);
  assert.match(shell, /<span className="[^"]*min-w-0[^"]*break-words[^"]*">\{accountContext\}<\/span>/);
});

test("renders the protected URL-filtered finalized transaction list", async () => {
  const [page, view] = await Promise.all([
    readSource("src/app/transactions/page.tsx"),
    readSource("src/components/transactions-page.tsx")
  ]);

  assert.match(page, /searchParams:\s*Promise</);
  assert.match(page, /await connection\(\)/);
  assert.match(page, /verifySessionToken/);
  assert.match(page, /if \(!session\) redirect\("\/"\)/);
  assert.match(page, /function jakartaToday\(\)/);
  assert.match(page, /timeZone:\s*"Asia\/Jakarta"/);
  assert.match(page, /parseTransactionFilters\(await searchParams\)/);
  assert.match(page, /Promise\.all\(\[\s*loadTransactionTimeline\(\{/s);
  assert.match(page, /loadPockets\(session\.telegramUserId\)/);
  assert.match(page, /pockets=\{pocketResult\.pockets\}/);
  assert.match(page, /telegramUserId:\s*session\.telegramUserId/);
  assert.match(page, /asOfDate:\s*jakartaToday\(\)/);
  assert.match(page, /title:\s*"Transactions"/);
  assert.match(page, /description:\s*"Review and correct your Veyra transactions"/);

  assert.match(view, /^"use client"/);
  assert.match(view, /activePage="transactions"/);
  assert.match(view, /accountContext="Transactions and schedules"/);
  for (const label of ["Cycle", "Calendar month", "Category", "Type", "Merchant Search"]) {
    assert.match(view, new RegExp(`>${label}<`));
  }
  for (const name of ["cycle", "month", "category", "type", "search"]) {
    assert.match(view, new RegExp(`name="${name}"`));
  }
  assert.match(view, /event\.preventDefault\(\)/);
  assert.match(view, /new FormData\(event\.currentTarget\)/);
  assert.match(view, /router\.push\(transactionHref\(filters, changes\)\)/);
  assert.match(view, /transactionHref\(filters, \{ \[filter\.key\]: null \}\)/);
  assert.match(view, />Clear Filters<\/Link>/);
  const delimiterCategoryKey = JSON.stringify([null, "a|income", null, null]);
  const categoryAndTypeKey = JSON.stringify([null, "a", "income", null]);
  assert.notEqual(delimiterCategoryKey, categoryAndTypeKey);
  assert.match(
    view,
    /key=\{JSON\.stringify\(\[filters\.cycle, filters\.month, filters\.category, filters\.type, filters\.search\]\)\}/
  );
  assert.match(view, /aria-label="Active filters"[^>]*className="[^"]*min-w-0/);
  assert.match(view, /aria-label=\{`Remove[^>]*className="[^"]*max-w-full[^"]*min-w-0[^"]*break-words/);
  assert.match(view, /name="search"[^>]*autoComplete="off"/);

  assert.match(view, /<caption[^>]*>Transactions and installment schedule<\/caption>/);
  for (const heading of ["Date", "Merchant", "Category", "Pocket", "Source", "Type", "Amount", "Action"]) {
    assert.match(view, new RegExp(`<th scope="col"[^>]*>${heading}</th>`));
  }
  assert.match(view, /<time dateTime=\{transaction\.transactionDate\}>/);
  assert.match(view, /transaction\.pocketName \?\? "No pocket"/);
  assert.match(view, /transaction\.type === "income" \? "\+" : ""/);
  assert.match(view, /formatIdr\(signedAmount\)/);
  assert.match(view, /<th scope="col" className="[^"]*tabular-nums[^"]*">Amount<\/th>/);
  assert.match(view, /<td className=\{`[^"]*tabular-nums/);
  assert.match(view, /entries?"\} on this page/);
  assert.match(
    view,
    /<p role="status" aria-live="polite" aria-atomic="true" className="sr-only">\s*<span key=\{resultAnnouncement\.key\}>\{resultAnnouncement\.message\}<\/span>\s*<\/p>/
  );
  assert.match(view, /transactionResultAnnouncementModel\(result, filters\)/);
  assert.doesNotMatch(view, /announcementNavigation|nextTransactionAnnouncementNavigation|navigationAwareTransactionResultAnnouncement/);
  const resultStatus = view.indexOf('<span key={resultAnnouncement.key}>');
  const resultBranches = view.indexOf("{unavailable ? (");
  assert.ok(resultStatus >= 0 && resultStatus < resultBranches);
  assert.doesNotMatch(view, /<section role="status"[^>]*>\s*<h2[^>]*>Transactions Couldn’t Be Loaded/);
  assert.match(view, /Transactions recorded through Telegram or email will appear here\./);
  assert.match(view, /No Transactions or Installment Entries Match These Filters\./);
  assert.match(view, /router\.refresh\(\)/);
  assert.match(view, /className="[^"]*transition-colors[^"]*hover:bg-veyra-navy-2[^"]*motion-reduce:transition-none">Retry<\/button>/);
  assert.match(view, /direction: "previous"/);
  assert.match(view, /direction: "next"/);
  assert.match(view, />Previous<\/Link>/);
  assert.match(view, />Next<\/Link>/);
  assert.doesNotMatch(view, /Create transaction|New transaction/);
});

test("renders mobile transaction records without table scrolling", async () => {
  const [view, loading] = await Promise.all([
    readSource("src/components/transactions-page.tsx"),
    readSource("src/app/transactions/loading.tsx")
  ]);

  assert.match(view, /transactions-desktop-table hidden md:block/);
  assert.match(view, /transactions-mobile-list divide-y/);
  assert.match(view, /transaction-mobile-filters/);
  assert.match(view, /<summary[^>]*>Filters/);
  assert.match(view, /aria-label="Transactions and installment schedule"/);
  assert.match(loading, /transactions-mobile-skeleton/);
});

test("edits a selected transaction in an accessible native side panel", async () => {
  const [dialog, view, css] = await Promise.all([
    readSource("src/components/transaction-edit-dialog.tsx"),
    readSource("src/components/transactions-page.tsx"),
    readSource("src/app/globals.css")
  ]);

  assert.match(dialog, /^"use client"/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /\.showModal\(\)/);
  assert.match(dialog, /useActionState\(editTransaction, initialEditState\)/);
  assert.match(dialog, /onClose=\{onClose\}/);
  assert.match(dialog, /onCancel=\{/);
  assert.match(dialog, /event\.preventDefault\(\);[\s\S]*closeDialog\(\);/);
  assert.match(dialog, /motion-reduce:transition-none/);

  for (const name of ["transactionId", "expectedUpdatedAt", "type"]) {
    assert.match(dialog, new RegExp(`type="hidden" name="${name}"`));
  }
  for (const field of ["amount", "merchant", "category", "pocketId"]) {
    assert.match(dialog, new RegExp(`name="${field}"`));
  }
  assert.match(dialog, /htmlFor=\{amountId\}/);
  assert.match(dialog, /htmlFor=\{merchantId\}/);
  assert.match(dialog, /htmlFor=\{categoryId\}/);
  assert.match(dialog, /htmlFor=\{pocketId\}/);
  assert.match(dialog, /<select[^>]*name="pocketId"/);
  assert.match(dialog, />No pocket<\/option>/);
  assert.match(dialog, /pocketsUnavailable && <input type="hidden" name="pocketId" value=\{selectedPocketId\}/);
  assert.match(dialog, /aria-describedby=\{/);
  assert.match(dialog, /aria-invalid=\{/);
  assert.match(dialog, /disabled=\{pending\}/);
  assert.match(dialog, /disabled=\{pending \|\| !dirty\}/);
  assert.match(dialog, /aria-busy=\{pending\}/);
  assert.match(dialog, /if \(pending\) return false;/);
  assert.match(dialog, /disabled=\{pending\}[^>]*aria-label="Close transaction editor"/s);
  assert.match(dialog, /disabled=\{pending\}[^>]*>Cancel<\/button>/s);
  assert.match(dialog, />Edit Transaction<\/h2>/);
  assert.match(dialog, /Save Changes/);
  assert.match(dialog, /state\.status === "validation"/);
  assert.match(dialog, /state\.status === "conflict"/);
  assert.match(dialog, />Reload transaction<\/button>/);
  assert.match(dialog, /state\.status === "not_found"/);
  assert.match(dialog, />Dismiss<\/button>/);
  assert.match(dialog, /state\.status === "unavailable"/);
  assert.match(dialog, /router\.refresh\(\)/);
  assert.match(dialog, /onSaved\(\)/);
  assert.match(dialog, /Credit used will adjust by/);
  assert.match(dialog, /transaction\.creditCard/);
  assert.match(dialog, /const parsedAmount = editableAmount\(amount\)/);
  assert.match(dialog, /parsedAmount === null \? null : parsedAmount - transaction\.amount/);
  assert.match(dialog, /Number\.isSafeInteger\(amountDelta\)/);
  assert.match(dialog, /value=\{merchant\}/);
  assert.match(dialog, /onChange=\{\(event\) => setMerchant\(event\.target\.value\)\}/);
  assert.match(dialog, /value=\{category\}/);
  assert.match(dialog, /onChange=\{\(event\) => setCategory\(event\.target\.value\)\}/);
  assert.match(dialog, /value=\{selectedPocketId\}/);
  assert.match(dialog, /onChange=\{\(event\) => setPocketId\(event\.target\.value\)\}/);
  assert.match(dialog, /transactionDate\.format\(new Date\(transaction\.transactionDate\)\)/);
  assert.match(dialog, /transaction\.type/);
  assert.match(dialog, /transaction\.source/);
  assert.doesNotMatch(dialog, /name="(?:date|transactionDate|source)"/);
  assert.doesNotMatch(dialog, /telegramUserId|CORE_API_KEY|NEXUS_CORE_URL/);

  assert.match(view, /useState<Transaction \| null>/);
  assert.match(view, /key=\{selectedTransaction\.id\}/);
  assert.match(view, /<TransactionEditDialog/);
  assert.match(view, /aria-label=\{`Edit transaction/);
  assert.match(view, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(view, /useState\(""\)/);
  assert.match(view, /role="status" aria-live="polite"/);
  assert.match(view, /setSaveAnnouncement\("Transaction saved\."\)/);
  assert.match(view, /shadow-\[inset_4px_0_0_var\(--color-veyra-cyan\)\]/);

  assert.match(css, /\.transaction-edit-dialog::backdrop/);
  assert.match(css, /border-left:\s*4px solid var\(--color-veyra-cyan\)/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("edits transactions through an independently authenticated server action", async () => {
  const actions = await readSource("src/app/transactions/actions.ts");

  assert.match(actions, /^"use server"/);
  assert.match(actions, /verifySessionToken/);
  assert.match(actions, /\(await cookies\(\)\)\.get\(SESSION_COOKIE\)\?\.value/);
  assert.match(actions, /parseTransactionEditForm\(formData\)/);
  assert.match(actions, /updateTransaction\(session\.telegramUserId, transactionId, input\)/);
  assert.match(actions, /if \(result\.status === "success"\) \{[\s\S]*revalidatePath\("\/transactions"\);[\s\S]*revalidatePath\("\/dashboard"\);/);
  assert.match(actions, /Promise<TransactionEditState>/);
  assert.doesNotMatch(actions, /formData\.(?:get|getAll)\(["']telegramUserId["']/);
  assert.doesNotMatch(actions, /redirect\(/);
});

test("manages pockets through independently authenticated server actions", async () => {
  const actions = await readSource("src/app/pockets/actions.ts");

  assert.match(actions, /^"use server"/);
  assert.match(actions, /verifySessionToken/);
  assert.match(actions, /\(await cookies\(\)\)\.get\(SESSION_COOKIE\)\?\.value/);
  for (const parser of ["parseCreatePocketForm", "parseRenamePocketForm", "parsePocketBudgetForm", "parseDefaultPocketForm"]) {
    assert.match(actions, new RegExp(`${parser}\\(formData\\)`));
  }
  assert.match(actions, /return session\?\.telegramUserId \?\? null/);
  assert.match(actions, /createPocket\(userId,/);
  assert.match(actions, /renamePocket\(userId, parsed\.value\.pocketId, parsed\.value\.name\)/);
  assert.match(actions, /loadPockets\(userId\)/);
  assert.match(actions, /updatePocketBudget\(userId, pocket\.name, parsed\.value\.amount\)/);
  assert.match(actions, /setDefaultPocket\(userId, parsed\.value\.pocketId\)/);
  assert.match(actions, /revalidatePath\("\/pockets"\);[\s\S]*revalidatePath\("\/transactions"\);[\s\S]*revalidatePath\("\/dashboard"\);/);
  assert.match(actions, /Promise<PocketActionState>/);
  assert.doesNotMatch(actions, /formData\.(?:get|getAll)\(["'](?:telegramUserId|userId)["']/);
  assert.doesNotMatch(actions, /redirect\(/);
});

test("renders protected pocket management with truthful loading and navigation", async () => {
  const [page, loading, shell] = await Promise.all([
    readSource("src/app/pockets/page.tsx"),
    readSource("src/app/pockets/loading.tsx"),
    readSource("src/components/app-shell.tsx")
  ]);

  assert.match(page, /await connection\(\)/);
  assert.match(page, /verifySessionToken/);
  assert.match(page, /if \(!session\) redirect\("\/"\)/);
  assert.match(page, /loadPockets\(session\.telegramUserId\)/);
  assert.match(page, /<PocketsPage result=\{result\} viewerName=\{session\.name\}/);
  assert.match(page, /title:\s*"Pockets"/);
  assert.match(page, /description:\s*"Manage your Veyra pockets and monthly budgets"/);

  assert.match(loading, /role="status" aria-live="polite"/);
  assert.match(loading, />Loading pockets…<\/span>/);
  assert.match(loading, /animate-pulse/);
  assert.doesNotMatch(loading, /IDR\s*[0-9]/);

  const pocketsLinkStart = shell.indexOf('<Link\n            href="/pockets"');
  const pocketsLinkEnd = shell.indexOf("</Link>", pocketsLinkStart);
  const pocketsLink = shell.slice(pocketsLinkStart, pocketsLinkEnd);
  assert.ok(pocketsLinkStart >= 0 && pocketsLinkEnd > pocketsLinkStart);
  assert.match(shell, /Wallet/);
  assert.match(shell, /type ActivePage = "overview" \| "transactions" \| "pockets"/);
  assert.match(pocketsLink, /\bPockets\b/);
  assert.match(pocketsLink, /aria-current=\{activePage === "pockets" \? "page" : undefined\}/);
  assert.match(pocketsLink, /className=\{activePage === "pockets" \? activeLink : inactiveLink\}/);
});

test("renders an ownership-checked pocket detail without dismissing attention", async () => {
  const page = await readSource("src/app/pockets/[pocketId]/page.tsx");

  assert.match(page, /params: Promise<\{ pocketId: string \}>/);
  assert.match(page, /verifySessionToken/);
  assert.match(page, /loadPocketStatus\(session\.telegramUserId, pocketId, jakartaToday\(\)\)/);
  assert.match(page, /if \(!status\) redirect\("\/dashboard"\)/);
  assert.match(page, /formatIdr\(status\.spent_amount\)/);
  assert.match(page, /formatIdr\(status\.budget_amount\)/);
  assert.match(page, /status\.child_breakdown/);
  assert.doesNotMatch(page, /dismiss|resolve|alert.*action/i);
});

test("offers accessible pocket dialogs and truthful pocket states", async () => {
  const [view, dialog] = await Promise.all([
    readSource("src/components/pockets-page.tsx"),
    readSource("src/components/pocket-dialog.tsx")
  ]);

  assert.match(view, /^"use client"/);
  assert.match(view, /activePage="pockets"/);
  assert.match(view, /formatIdr\(pocket\.amount\)/);
  assert.match(view, /No Budget Set/);
  assert.match(view, /Default/);
  for (const label of ["Add Pocket", "Rename", "Set Budget", "Make Default"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /Pockets Couldn’t Be Loaded/);
  assert.match(view, />Retry<\/button>/);
  assert.match(view, /No Pockets Yet/);
  assert.match(view, /role="status" aria-live="polite"/);
  assert.match(view, /returnFocusRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(view, /Delete|Archive/);

  assert.match(dialog, /^"use client"/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /\.showModal\(\)/);
  assert.match(dialog, /useActionState\(/);
  assert.match(dialog, /aria-labelledby=\{titleId\}/);
  assert.match(dialog, /aria-describedby=\{/);
  assert.match(dialog, /aria-invalid=\{/);
  assert.match(dialog, /disabled=\{pending\}/);
  assert.match(dialog, /state\.status === "success"/);
  assert.match(dialog, /dialogRef\.current\?\.close\(\)/);
  assert.match(dialog, /onSaved\(\)/);
  for (const title of ["Add Pocket", "Rename Pocket", "Set Monthly Budget"]) {
    assert.match(dialog, new RegExp(title));
  }
  assert.match(dialog, /Save Changes/);
  assert.doesNotMatch(dialog, /Delete|Archive|null-budget/);
});

test("keeps mobile sheets safe and prevents silent dirty closes", async () => {
  const [transactionDialog, pocketDialog, css] = await Promise.all([
    readSource("src/components/transaction-edit-dialog.tsx"),
    readSource("src/components/pocket-dialog.tsx"),
    readSource("src/app/globals.css")
  ]);

  assert.match(transactionDialog, /Discard unsaved changes\?/);
  assert.match(transactionDialog, /beforeunload/);
  assert.match(transactionDialog, /autoComplete="off"/);
  assert.match(pocketDialog, /role="status" aria-live="polite"/);
  assert.match(pocketDialog, /autoComplete="off"/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test("guards Next in-app navigation while the transaction editor is dirty", async () => {
  const dialog = await readSource("src/components/transaction-edit-dialog.tsx");

  assert.match(dialog, /document\.addEventListener\("click", navigationGuard, true\)/);
  assert.match(dialog, /event\.stopImmediatePropagation\(\)/);
  assert.match(dialog, /Discard unsaved changes\?/);
});

test("guards programmatic navigation while the transaction editor is dirty", async () => {
  const [dialog, view] = await Promise.all([
    readSource("src/components/transaction-edit-dialog.tsx"),
    readSource("src/components/transactions-page.tsx")
  ]);

  assert.match(dialog, /window\.addEventListener\("veyra:before-navigation", navigationGuard\)/);
  assert.match(dialog, /if \(pending \|\| !window\.confirm\("Discard unsaved changes\?"\)\) event\.preventDefault\(\);/);
  assert.match(view, /if \(!window\.dispatchEvent\(new Event\("veyra:before-navigation", \{ cancelable: true \}\)\)\) return;/);
  assert.equal((dialog.match(/veyra:before-navigation/g) ?? []).length, 2);
  assert.equal((view.match(/veyra:before-navigation/g) ?? []).length, 1);
});

test("refreshes a transaction only after its dialog closes", async () => {
  const dialog = await readSource("src/components/transaction-edit-dialog.tsx");
  const reloadStart = dialog.indexOf("function reloadTransaction");
  const reloadEnd = dialog.indexOf("\n  }\n\n  const amountError", reloadStart);
  const reload = dialog.slice(reloadStart, reloadEnd);

  assert.match(dialog, /function closeDialog\(force = false\): boolean/);
  assert.match(dialog, /if \(pending\) return false;/);
  assert.match(dialog, /if \(!force && dirty && !window\.confirm\("Discard unsaved changes\?"\)\) return false;/);
  assert.match(dialog, /dialogRef\.current\?\.close\(\);\s*return true;/);
  assert.match(reload, /if \(closeDialog\(state\.status === "conflict" \|\| state\.status === "not_found"\)\) router\.refresh\(\);/);
  assert.ok(reload.indexOf("closeDialog") < reload.indexOf("router.refresh"));
});

test("uses divided pockets with compact mobile actions", async () => {
  const [view, loading] = await Promise.all([
    readSource("src/components/pockets-page.tsx"),
    readSource("src/app/pockets/loading.tsx")
  ]);

  assert.match(view, /pocket-list divide-y/);
  assert.match(view, /<details className="pocket-mobile-actions/);
  assert.match(view, /<summary[^>]*>More Actions<\/summary>/);
  assert.match(view, /hidden gap-2 sm:flex/);
  assert.match(loading, /pocket-list-skeleton/);
});

test("aligns primary page content and preserves the truthful pocket workspace", async () => {
  const [overview, transactions, pockets, overviewLoading, transactionsLoading, pocketsLoading] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/components/transactions-page.tsx"),
    readSource("src/components/pockets-page.tsx"),
    readSource("src/app/dashboard/loading.tsx"),
    readSource("src/app/transactions/loading.tsx"),
    readSource("src/app/pockets/loading.tsx")
  ]);
  const wrapper = /mx-auto max-w-\[1280px\][^\"]*xl:px-2 xl:py-1/;

  for (const page of [overview, transactions, pockets]) assert.match(page, wrapper);
  for (const loading of [overviewLoading, transactionsLoading, pocketsLoading]) assert.match(loading, wrapper);

  assert.match(pockets, /const pocketCountLabel = `\$\{result\.pockets\.length\} \$\{result\.pockets\.length === 1 \? "pocket" : "pockets"\}`;/);
  assert.match(pockets, /<p className="text-sm font-semibold text-slate-600">\{pocketCountLabel\}<\/p>/);
  assert.match(pockets, /<h3 className="min-w-0 break-words text-base font-bold text-veyra-ink">\{pocket\.name\}<\/h3>/);
  const workspace = /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,20rem\)\]/;
  assert.match(pockets, workspace);
  assert.match(pocketsLoading, workspace);
  assert.match(pockets, /<aside aria-labelledby="pocket-guidance-title"/);
  assert.match(pocketsLoading, /<aside[^>]+aria-label="Loading pocket guidance"/);
  assert.match(pocketsLoading, /h-3 w-32/);
  assert.match(pocketsLoading, /mt-1 h-8 w-28/);
  assert.match(pockets, /<p className="mt-1 max-w-2xl text-sm text-slate-600">Organize the budgets Veyra uses for your transactions\.<\/p>/);
  assert.match(pocketsLoading, /mt-1 h-10 w-72 max-w-full sm:h-5/);
  for (const label of ["Add Pocket", "Rename", "Set Budget", "Make Default", "More Actions"]) {
    assert.match(pockets, new RegExp(label));
  }
  for (const state of ["Pockets Couldn’t Be Loaded", "No Pockets Yet", "router\\.refresh\\(\\)"]) {
    assert.match(pockets, new RegExp(state));
  }
  assert.doesNotMatch(pockets, /pocket\.(?:spent|remaining|used|limit)/);
});

test("keeps transaction loading stable and documents correction boundary", async () => {
  const [loading, readme, backlog] = await Promise.all([
    readSource("src/app/transactions/loading.tsx"),
    readSource("README.md"),
    readSource("BACKLOG.md")
  ]);

  assert.match(loading, /aria-label="Loading transactions…"/);
  assert.match(loading, /role="status" aria-live="polite"/);
  assert.match(loading, />Loading transactions…<\/span>/);
  assert.match(loading, /Transaction filters/);
  assert.match(loading, /Finalized transaction records/);
  assert.match(loading, /animate-pulse/);
  assert.doesNotMatch(loading, /IDR\s*[0-9]/);

  assert.match(readme, /POST <NEXUS_CORE_URL>\/api\/veyra\/transactions\/timeline\/query/);
  assert.match(readme, /PATCH <NEXUS_CORE_URL>\/api\/veyra\/transactions\/:transactionId/);
  assert.match(readme, /verified Telegram user ID.*server-side/i);
  assert.match(readme, /amount, merchant, and category/i);
  assert.match(readme, /conflict/i);
  assert.match(readme, /credit_used/i);
  assert.doesNotMatch(readme, /Veyra is a read-only financial dashboard\./);
  assert.match(backlog, /B-005 — Deliver transaction list and corrections/);
  assert.match(backlog, /Status:\*\* Active/);
});

test("offers only real Telegram login and safe provider errors", async () => {
  const [loginPage, actions] = await Promise.all([
    readSource("src/app/page.tsx"),
    readSource("src/app/actions.ts")
  ]);

  assert.match(loginPage, /href="\/auth\/telegram"/);
  assert.match(loginPage, /Login with Telegram/);
  assert.match(loginPage, /access_denied/);
  assert.match(loginPage, /telegram_login/);
  assert.doesNotMatch(loginPage, /Login with Email|action=\{login\}/);
  assert.doesNotMatch(actions, /DEMO_SESSION|export async function login/);
});

test("documents and supplies the production auth environment", async () => {
  const [example, compose, deploy] = await Promise.all([
    readSource(".env.example"),
    readSource("docker-compose.yaml"),
    readSource(".github/workflows/deploy.yml")
  ]);

  for (const name of [
    "APP_URL",
    "TELEGRAM_CLIENT_ID",
    "TELEGRAM_CLIENT_SECRET",
    "TELEGRAM_BOT_TOKEN",
    "AUTH_SECRET",
    "NEXUS_CORE_URL",
    "CORE_API_KEY"
  ]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.match(compose, new RegExp(name));
  }

  assert.match(example, /^APP_URL=https:\/\/veyra\.darilnofriansyah\.my\.id$/m);
  assert.match(compose, /http:\/\/core-api:3000/);
  assert.match(compose, /veyra-network/);
  assert.match(deploy, /docker compose --env-file \/home\/unmeii\/apps\/\.env/);
  assert.doesNotMatch(`${example}\n${compose}`, /VEYRA_TELEGRAM_USER_ID|VEYRA_USER_ID/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_/);

  const clientSources = await Promise.all([
    "src/components/telegram-mini-app.tsx",
    "src/components/app-shell.tsx",
    "src/components/overview-dashboard.tsx",
    "src/components/transactions-page.tsx",
    "src/components/pockets-page.tsx"
  ].map(readSource));
  assert.doesNotMatch(
    clientSources.join("\n"),
    /TELEGRAM_BOT_TOKEN|NEXT_PUBLIC_TELEGRAM/
  );
});
