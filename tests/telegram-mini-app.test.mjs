import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("loads Telegram runtime and mounts one client bridge", async () => {
  const [layout, page, bridge] = await Promise.all([
    readFile("src/app/layout.tsx", "utf8"),
    readFile("src/app/page.tsx", "utf8"),
    readFile("src/components/telegram-mini-app.tsx", "utf8")
  ]);
  assert.match(layout, /telegram-web-app\.js(?:\?63)?/);
  assert.match(layout, /strategy="beforeInteractive"/);
  assert.match(layout, /<TelegramMiniApp\s*\/>/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(page, /id="login-page"/);
  assert.match(bridge, /^"use client"/);
  assert.match(bridge, /webApp\.ready\(\)/);
  assert.match(bridge, /webApp\.expand\(\)/);
  assert.match(bridge, /webApp\.initData/);
  assert.doesNotMatch(bridge, /initDataUnsafe/);
  assert.match(bridge, /fetch\("\/auth\/telegram\/mini-app"/);
  assert.match(bridge, /body:\s*webApp\.initData/);
  assert.match(bridge, /window\.location\.replace\("\/dashboard"\)/);
});

test("cleans up Telegram chrome and BackButton handlers", async () => {
  const bridge = await readFile("src/components/telegram-mini-app.tsx", "utf8");
  for (const event of ["themeChanged", "viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"]) {
    assert.match(bridge, new RegExp(`"${event}"`));
  }
  assert.match(bridge, /isVersionAtLeast\?\.\("8\.0"\)/);
  assert.match(bridge, /webApp\.onEvent/);
  assert.match(bridge, /webApp\.offEvent/);
  assert.match(bridge, /addEventListener\("resize"/);
  assert.match(bridge, /removeEventListener\("resize"/);
  assert.match(bridge, /BackButton\.onClick/);
  assert.match(bridge, /BackButton\.offClick/);
  assert.match(bridge, /pathname === "\/transactions" \|\| pathname === "\/pockets"/);
  assert.match(bridge, /router\.replace\("\/dashboard"\)/);
});

test("keeps automatic login accessible and inside Telegram", async () => {
  const bridge = await readFile("src/components/telegram-mini-app.tsx", "utf8");
  assert.match(bridge, /role="status"/);
  assert.match(bridge, /role="alert"/);
  assert.match(bridge, /aria-live="polite"/);
  assert.match(bridge, /fixed inset-0/);
  assert.match(bridge, /z-\d+/);
  assert.match(bridge, /login-page/);
  assert.match(bridge, />Retry<\/button>/);
  assert.match(bridge, /does not have access to Veyra/);
  assert.match(bridge, /close and reopen Veyra/);
  assert.match(bridge, /temporarily unavailable/);
  assert.match(bridge, /AbortController/);
  assert.match(bridge, /credentials:\s*"same-origin"/);
  assert.match(bridge, /cache:\s*"no-store"/);
  assert.doesNotMatch(bridge, /(?:BOT_TOKEN|API_KEY|CLIENT_SECRET|AUTH_SECRET|sessionToken|secret)/i);
  for (const forbidden of ["localStorage", "sessionStorage", "console.", "initDataUnsafe"]) {
    assert.doesNotMatch(bridge, new RegExp(forbidden.replace(".", "\\.")));
  }
  assert.doesNotMatch(bridge, /URLSearchParams\s*\([^)]*initData/);
  assert.doesNotMatch(bridge, /(?:location|href|replace)[^\n;]*initData/);
});

test("restores login interactivity after authentication settles", async () => {
  const bridge = await readFile("src/components/telegram-mini-app.tsx", "utf8");
  assert.match(bridge, /loginPage\.inert = authState === "authenticating"/);
  assert.match(bridge, /\[authState\]/);
});

test("adapts only the narrow Telegram shell for safe areas", async () => {
  const [shell, pocketDialog, css] = await Promise.all([
    readFile("src/components/app-shell.tsx", "utf8"),
    readFile("src/components/pocket-dialog.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8")
  ]);
  for (const name of ["app-shell", "app-sidebar", "app-brand", "app-nav", "app-account"]) {
    assert.match(shell, new RegExp(name));
  }
  assert.match(css, /html\[data-telegram-mini-app="true"\]/);
  assert.match(css, /--veyra-telegram-viewport-height/);
  assert.match(css, /--veyra-telegram-stable-height/);
  assert.match(css, /--veyra-telegram-safe-top/);
  assert.match(css, /--veyra-telegram-safe-bottom/);
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /a\[aria-current="page"\]/);
  assert.match(pocketDialog, /pocket-dialog/);
  assert.match(css, /\.pocket-dialog/);
});
