import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(path, "utf8").catch(() => "");

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
    "Financial health",
    "Spending Trend",
    "Spending by Category",
    "Budget Status",
    "Recent Transactions",
    "Latest Alert",
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
    dashboard.indexOf('aria-label="Financial health"')
      < dashboard.indexOf('aria-label="Credit card"')
  );
});

test("uses raw budget status for rows, accessibility, and alert semantics", async () => {
  const [dashboard, finance] = await Promise.all([
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/lib/finance.ts")
  ]);

  assert.match(dashboard, /budget\.status/);
  assert.match(dashboard, /statusLabel\[budget\.status\]/);
  assert.match(dashboard, /\{budget\.percent\}% · \{statusLabel\[budget\.status\]\}/);
  assert.match(dashboard, /latestAlert\.status/);
  assert.match(dashboard, /summary\?\.alert\s*\?\?\s*summary\?\.budgets\.find/);
  assert.doesNotMatch(dashboard, /summary\.alert\.percent\s*>=\s*80/);
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
  assert.match(page, /await loadTransactions\(\{/);
  assert.match(page, /telegramUserId:\s*session\.telegramUserId/);
  assert.match(page, /asOfDate:\s*jakartaToday\(\)/);
  assert.match(page, /title:\s*"Transactions"/);
  assert.match(page, /description:\s*"Review and correct your Veyra transactions"/);

  assert.match(view, /^"use client"/);
  assert.match(view, /activePage="transactions"/);
  assert.match(view, /accountContext="Finalized records"/);
  for (const label of ["Cycle", "Category", "Type", "Merchant search"]) {
    assert.match(view, new RegExp(`>${label}<`));
  }
  for (const name of ["cycle", "category", "type", "search"]) {
    assert.match(view, new RegExp(`name="${name}"`));
  }
  assert.match(view, /event\.preventDefault\(\)/);
  assert.match(view, /new FormData\(event\.currentTarget\)/);
  assert.match(view, /router\.push\(transactionHref\(filters, changes\)\)/);
  assert.match(view, /transactionHref\(filters, \{ \[filter\.key\]: null \}\)/);
  assert.match(view, />Clear filters<\/Link>/);
  const delimiterCategoryKey = JSON.stringify([null, "a|income", null, null]);
  const categoryAndTypeKey = JSON.stringify([null, "a", "income", null]);
  assert.notEqual(delimiterCategoryKey, categoryAndTypeKey);
  assert.match(
    view,
    /key=\{JSON\.stringify\(\[filters\.cycle, filters\.category, filters\.type, filters\.search\]\)\}/
  );
  assert.match(view, /aria-label="Active filters"[^>]*className="[^"]*min-w-0/);
  assert.match(view, /aria-label=\{`Remove[^>]*className="[^"]*max-w-full[^"]*min-w-0[^"]*break-words/);
  assert.match(view, /name="search"[^>]*autoComplete="off"/);

  assert.match(view, /<caption[^>]*>Finalized transaction records<\/caption>/);
  for (const heading of ["Date", "Merchant", "Category", "Source", "Type", "Amount", "Action"]) {
    assert.match(view, new RegExp(`<th scope="col"[^>]*>${heading}</th>`));
  }
  assert.match(view, /<time dateTime=\{transaction\.transactionDate\}>/);
  assert.match(view, /transaction\.type === "income" \? "\+" : ""/);
  assert.match(view, /formatIdr\(signedAmount\)/);
  assert.match(view, /<th scope="col" className="[^"]*tabular-nums[^"]*">Amount<\/th>/);
  assert.match(view, /<td className=\{`[^"]*tabular-nums/);
  assert.match(view, /transactions?"\} on this page/);
  assert.match(
    view,
    /<p role="status" aria-live="polite" aria-atomic="true" className="sr-only">\{resultAnnouncement\}<\/p>/
  );
  assert.match(view, /useState\(\s*\(\) => nextTransactionAnnouncementNavigation\(null, filters\)\s*\)/);
  assert.match(view, /useEffect\(\(\) => \{[\s\S]*nextTransactionAnnouncementNavigation\(previous, filters\)/);
  assert.match(view, /navigationAwareTransactionResultAnnouncement\(result, announcementNavigation\)/);
  const resultStatus = view.indexOf('{resultAnnouncement}</p>');
  const resultBranches = view.indexOf("{unavailable ? (");
  assert.ok(resultStatus >= 0 && resultStatus < resultBranches);
  assert.doesNotMatch(view, /<section role="status"[^>]*>\s*<h2[^>]*>Transactions couldn’t be loaded/);
  assert.match(view, /Transactions recorded through Telegram or email will appear here\./);
  assert.match(view, /No finalized transactions match these filters\./);
  assert.match(view, /router\.refresh\(\)/);
  assert.match(view, /className="[^"]*transition-colors[^"]*hover:bg-veyra-navy-2[^"]*motion-reduce:transition-none">Retry<\/button>/);
  assert.match(view, /direction: "previous"/);
  assert.match(view, /direction: "next"/);
  assert.match(view, />Previous<\/Link>/);
  assert.match(view, />Next<\/Link>/);
  assert.doesNotMatch(view, /Create transaction|New transaction/);
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
  assert.match(dialog, /motion-reduce:transition-none/);

  for (const name of ["transactionId", "expectedUpdatedAt", "type"]) {
    assert.match(dialog, new RegExp(`type="hidden" name="${name}"`));
  }
  for (const field of ["amount", "merchant", "category"]) {
    assert.match(dialog, new RegExp(`name="${field}"`));
  }
  assert.match(dialog, /htmlFor=\{amountId\}/);
  assert.match(dialog, /htmlFor=\{merchantId\}/);
  assert.match(dialog, /htmlFor=\{categoryId\}/);
  assert.match(dialog, /aria-describedby=\{/);
  assert.match(dialog, /aria-invalid=\{/);
  assert.match(dialog, /disabled=\{pending\}/);
  assert.match(dialog, /disabled=\{pending \|\| !dirty\}/);
  assert.match(dialog, /aria-busy=\{pending\}/);
  assert.match(dialog, /if \(pending\) return;/);
  assert.match(dialog, /if \(!pending\) event\.currentTarget\.close\(\);/);
  assert.match(dialog, /disabled=\{pending\}[^>]*aria-label="Close transaction editor"/s);
  assert.match(dialog, /disabled=\{pending\}[^>]*>Cancel<\/button>/s);
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

  assert.match(readme, /POST <NEXUS_CORE_URL>\/api\/veyra\/transactions\/query/);
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
});
