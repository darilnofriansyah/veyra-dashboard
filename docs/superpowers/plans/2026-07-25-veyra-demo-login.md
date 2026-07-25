# Veyra Demo Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Veyra login at `/`, guard the existing dashboard at `/dashboard` with a local demo cookie, and provide sign out.

**Architecture:** A Next.js 16 `src/proxy.ts` performs centralized optimistic redirects for `/` and `/dashboard`. Native forms call Server Actions that set or delete one HTTP-only browser-session cookie; the login remains a fixture-only experience gate, not real authentication.

**Tech Stack:** Next.js 16.2.11 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Phosphor Icons, Node test runner, Sharp

## Global Constraints

- Login route is `/`; dashboard route is `/dashboard`.
- `src/proxy.ts` owns the route guard.
- Both login buttons call the same local demo action.
- Cookie name is exactly `veyra_demo_session`.
- The cookie is HTTP-only, `sameSite: "lax"`, root-scoped, secure only in production, and has no persistent expiry.
- The cookie must never protect real financial data.
- Do not add JWT, an auth provider, a database, credentials, user records, or a new dependency.
- Omit account creation, account switching, Terms of Service, and Privacy Policy controls.
- Derive the login line art from `public/assets/veyra-dashboard-portrait.png`; do not change the existing dashboard artwork.
- Preserve all current dashboard financial behavior and development-only data states.
- Preserve keyboard support, visible focus, reduced motion, 200% text support, and a 320px minimum viewport.
- Do not modify the user's existing `.dockerignore` or `docker-compose.yaml` changes.

## File Map

- Create `public/assets/veyra-login-line-art.webp`: transparent cyan line-art derivative used only by the login page.
- Create `src/lib/demo-session.ts`: shared demo-cookie constants and exact-value validation.
- Create `src/proxy.ts`: centralized redirects for the public and protected routes.
- Create `src/app/actions.ts`: login and sign-out Server Actions.
- Create `src/app/dashboard/page.tsx`: existing dashboard route plus route-specific metadata.
- Create `src/app/dashboard/loading.tsx`: existing Overview loading UI, moved with the dashboard.
- Replace `src/app/page.tsx`: server-rendered login page and approved visual composition.
- Modify `src/app/layout.tsx`: generic Veyra metadata template.
- Modify `src/components/overview-dashboard.tsx`: add the sign-out form to the existing account area.
- Create `tests/demo-session.test.mjs`: executable proxy redirect contract.
- Modify `tests/static.test.mjs`: update dashboard paths and assert the login/action/sign-out composition.
- Modify `tests/assets.test.mjs`: validate the new optimized transparent artwork.

---

### Task 1: Produce the approved line-art asset

**Files:**
- Create: `public/assets/veyra-login-line-art.webp`
- Modify: `tests/assets.test.mjs`

**Interfaces:**
- Consumes: `public/assets/veyra-dashboard-portrait.png`
- Produces: `/assets/veyra-login-line-art.webp`, a transparent image large enough for the desktop login composition

- [ ] **Step 1: Add the failing asset check**

Append this test to `tests/assets.test.mjs`:

```js
test("keeps login line art production-ready", async () => {
  const path = "public/assets/veyra-login-line-art.webp";
  assert.equal(existsSync(path), true, "login line art must exist");

  const artwork = await sharp(path).metadata();
  assert.ok(artwork.width >= 1000, "login line art must support desktop placement");
  assert.ok(artwork.height >= 1400, "login line art must support portrait placement");
  assert.equal(artwork.hasAlpha, true, "login line art must keep transparency");
  assert.ok((await stat(path)).size < 700_000, "login line art must stay optimized");
});
```

- [ ] **Step 2: Run the asset check and confirm the missing file fails**

Run:

```bash
node --test tests/assets.test.mjs
```

Expected: FAIL with `login line art must exist`.

- [ ] **Step 3: Generate the line-art derivative**

Read and follow the `imagegen` skill. Inspect
`public/assets/veyra-dashboard-portrait.png` with the local image viewer, then
edit that image with this prompt:

```text
Create a transparent-background line-art derivative of this exact Veyra character and pose for a clean financial-app login page. Preserve the face, hair, body proportions, outfit, hand position, and character identity. Replace the full-color rendering with elegant restrained cyan and pale-blue technical ink lines, using a few darker navy contour accents for legibility. Remove the held holographic dashboard and all background elements. Keep the full figure isolated, crisp, and production-ready, with generous transparent padding around the silhouette. Do not create a new pose, costume, expression, character interpretation, text, logo, border, glow field, or scenery.
```

Save the generated source temporarily outside the repository as
`/tmp/veyra-login-line-art.png`.

- [ ] **Step 4: Trim and optimize the approved result**

Run:

```bash
node --input-type=module -e 'import sharp from "sharp"; await sharp("/tmp/veyra-login-line-art.png").trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize({ width: 1400, height: 2100, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toFile("public/assets/veyra-login-line-art.webp")'
```

Inspect `public/assets/veyra-login-line-art.webp`. Confirm it uses the existing
character and pose, reads as cyan line art, has no background, and has no
holographic panel.

- [ ] **Step 5: Run the asset check**

Run:

```bash
node --test tests/assets.test.mjs
```

Expected: both asset tests PASS.

- [ ] **Step 6: Commit the asset**

```bash
git add tests/assets.test.mjs public/assets/veyra-login-line-art.webp
git commit -m "feat: add Veyra login line art"
```

---

### Task 2: Add the centralized demo-session guard

**Files:**
- Create: `src/lib/demo-session.ts`
- Create: `src/proxy.ts`
- Create: `tests/demo-session.test.mjs`

**Interfaces:**
- Produces: `DEMO_SESSION_COOKIE: "veyra_demo_session"`
- Produces: `DEMO_SESSION_VALUE: "active"`
- Produces: `hasDemoSession(value: string | undefined): boolean`
- Produces: `proxy(request: NextRequest): NextResponse`
- Consumes later: `src/app/actions.ts` imports the cookie constants

- [ ] **Step 1: Write the failing redirect contract**

Create `tests/demo-session.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE,
  hasDemoSession
} from "../src/lib/demo-session.ts";
import { config, proxy } from "../src/proxy.ts";

function request(path, cookieValue) {
  const headers = cookieValue === undefined
    ? undefined
    : { cookie: `${DEMO_SESSION_COOKIE}=${cookieValue}` };

  return new NextRequest(`http://localhost${path}`, { headers });
}

test("accepts only the exact demo session value", () => {
  assert.equal(hasDemoSession(DEMO_SESSION_VALUE), true);
  assert.equal(hasDemoSession(undefined), false);
  assert.equal(hasDemoSession("invalid"), false);
});

test("redirects signed-out dashboard requests to login", () => {
  const response = proxy(request("/dashboard"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
});

test("redirects signed-in login requests to the dashboard", () => {
  const response = proxy(request("/", DEMO_SESSION_VALUE));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/dashboard");
});

test("allows the expected route for each session state", () => {
  const login = proxy(request("/"));
  const dashboard = proxy(request("/dashboard", DEMO_SESSION_VALUE));

  assert.equal(login.status, 200);
  assert.equal(login.headers.get("location"), null);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("location"), null);
});

test("treats an invalid cookie as signed out and limits the matcher", () => {
  const response = proxy(request("/dashboard", "invalid"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
  assert.deepEqual(config.matcher, ["/", "/dashboard"]);
});
```

- [ ] **Step 2: Run the new test and confirm the missing modules fail**

Run:

```bash
node --test tests/demo-session.test.mjs
```

Expected: FAIL because `src/lib/demo-session.ts` does not exist.

- [ ] **Step 3: Add the shared cookie contract**

Create `src/lib/demo-session.ts`:

```ts
export const DEMO_SESSION_COOKIE = "veyra_demo_session";
export const DEMO_SESSION_VALUE = "active";

export function hasDemoSession(value: string | undefined) {
  return value === DEMO_SESSION_VALUE;
}
```

- [ ] **Step 4: Add the Next.js 16 proxy**

Create `src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  hasDemoSession
} from "./lib/demo-session";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const signedIn = hasDemoSession(
    request.cookies.get(DEMO_SESSION_COOKIE)?.value
  );

  if (path === "/" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (path === "/dashboard" && !signedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard"]
};
```

- [ ] **Step 5: Run the redirect contract**

Run:

```bash
node --test tests/demo-session.test.mjs
```

Expected: all five tests PASS.

- [ ] **Step 6: Run the existing suite**

Run:

```bash
npm test
```

Expected: the full existing suite and the new proxy tests PASS.

- [ ] **Step 7: Commit the guard**

```bash
git add src/lib/demo-session.ts src/proxy.ts tests/demo-session.test.mjs
git commit -m "feat: guard demo dashboard routes"
```

---

### Task 3: Add the login flow and move the dashboard

**Files:**
- Create: `src/app/actions.ts`
- Replace: `src/app/page.tsx`
- Create from existing route: `src/app/dashboard/page.tsx`
- Create from existing route: `src/app/dashboard/loading.tsx`
- Delete after moving: `src/app/loading.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/overview-dashboard.tsx:3-11,79-82`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: `DEMO_SESSION_COOKIE` and `DEMO_SESSION_VALUE` from `src/lib/demo-session.ts`
- Consumes: `/assets/veyra-login-line-art.webp`
- Produces: `login(): Promise<never>` and `logout(): Promise<never>` Server Actions
- Produces: the public login route and authenticated dashboard route

- [ ] **Step 1: Point dashboard regression tests at the new route**

In `tests/static.test.mjs`, change every dashboard page read from
`src/app/page.tsx` to `src/app/dashboard/page.tsx`, and change every Overview
loading read from `src/app/loading.tsx` to
`src/app/dashboard/loading.tsx`.

In the first test, read both routes and assert the new ownership:

```js
const [login, dashboardPage, dashboard, css, postcss] = await Promise.all([
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/app/dashboard/page.tsx", "utf8"),
  readFile("src/components/overview-dashboard.tsx", "utf8"),
  readFile("src/app/globals.css", "utf8"),
  readFile("postcss.config.mjs", "utf8")
]);

assert.match(login, /Welcome to Veyra/);
assert.match(dashboardPage, /OverviewDashboard/);
```

Keep the existing dashboard, Tailwind, period, and unfinished-destination
assertions unchanged.

- [ ] **Step 2: Add the failing login composition check**

Add this test to `tests/static.test.mjs`:

```js
test("composes the approved demo login and reversible session flow", async () => {
  const [loginPage, actions, dashboard, layout] = await Promise.all([
    readSource("src/app/page.tsx"),
    readSource("src/app/actions.ts"),
    readSource("src/components/overview-dashboard.tsx"),
    readSource("src/app/layout.tsx")
  ]);

  assert.match(loginPage, /Welcome to Veyra/);
  assert.match(loginPage, /Secure\\. Intelligent\\. Always in control\\./);
  assert.match(loginPage, /Login with Telegram/);
  assert.match(loginPage, /Login with Email/);
  assert.equal([...loginPage.matchAll(/action=\\{login\\}/g)].length, 2);
  assert.match(loginPage, /veyra-login-line-art\\.webp/);
  assert.match(loginPage, /alt=""/);
  assert.doesNotMatch(loginPage, /Create one|Switch Account|Terms of Service|Privacy Policy/);

  assert.match(actions, /cookieStore\\.set\\(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE/);
  assert.match(actions, /httpOnly:\\s*true/);
  assert.match(actions, /sameSite:\\s*"lax"/);
  assert.match(actions, /secure:\\s*process\\.env\\.NODE_ENV === "production"/);
  assert.match(actions, /cookieStore\\.delete\\(DEMO_SESSION_COOKIE\\)/);
  assert.match(actions, /redirect\\("\\/dashboard"\\)/);
  assert.match(actions, /redirect\\("\\/"\\)/);

  assert.match(dashboard, /action=\\{logout\\}/);
  assert.match(dashboard, />Sign out<\\/button>/);
  assert.match(layout, /template:\\s*"%s · Veyra"/);
});
```

- [ ] **Step 3: Run the static tests and confirm the route move is missing**

Run:

```bash
node --test tests/static.test.mjs
```

Expected: FAIL because `src/app/dashboard/page.tsx`,
`src/app/dashboard/loading.tsx`, and `src/app/actions.ts` do not exist.

- [ ] **Step 4: Move the existing dashboard route files**

Run:

```bash
mkdir -p src/app/dashboard
git mv src/app/page.tsx src/app/dashboard/page.tsx
git mv src/app/loading.tsx src/app/dashboard/loading.tsx
```

Update `src/app/dashboard/page.tsx` to add route-specific metadata while
retaining the existing loader body:

```tsx
import { OverviewDashboard } from "@/components/overview-dashboard";
import { loadOverview, type DemoState } from "@/lib/overview-loader";
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
```

Do not change the contents of `src/app/dashboard/loading.tsx`.

- [ ] **Step 5: Add the two Server Actions**

Create `src/app/actions.ts`:

```ts
"use server";

import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE
} from "@/lib/demo-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect("/");
}
```

- [ ] **Step 6: Give the root layout generic page metadata**

Replace the metadata in `src/app/layout.tsx` with:

```tsx
export const metadata: Metadata = {
  title: {
    default: "Veyra",
    template: "%s · Veyra"
  },
  description: "Veyra financial overview"
};
```

Leave the HTML and body structure unchanged.

- [ ] **Step 7: Add the completed login page**

Create `src/app/page.tsx`:

```tsx
import { login } from "@/app/actions";
import { EnvelopeSimple, TelegramLogo } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Login",
  description: "Enter the Veyra dashboard demo"
};

const loginButton = "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-white p-4 text-veyra-ink sm:p-6">
      <Image
        src="/assets/veyra-logo.png"
        width={840}
        height={194}
        sizes="132px"
        alt="Veyra"
        className="relative z-20 h-auto w-[132px]"
        preload
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-veyra-cyan opacity-25"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <path d="M0 175H170L210 215H520L590 285H1440" fill="none" stroke="currentColor" />
        <path d="M0 770H130L190 710H510L570 650" fill="none" stroke="currentColor" />
        <path d="M1080 0V105L1015 170V340" fill="none" stroke="currentColor" />
      </svg>

      <div className="relative mx-auto grid min-h-[calc(100dvh-80px)] max-w-6xl items-center lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section
          aria-labelledby="login-title"
          className="relative z-10 rounded-veyra border border-veyra-line bg-white/95 p-6 shadow-[0_18px_50px_rgba(18,23,34,0.08)] sm:p-8"
        >
          <h1 id="login-title" className="text-2xl font-bold tracking-[-0.03em]">
            Welcome to Veyra
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Secure. Intelligent. Always in control.
          </p>

          <form action={login} className="mt-8">
            <button
              type="submit"
              className={`${loginButton} bg-sky-600 text-white hover:bg-sky-700`}
            >
              <TelegramLogo size={18} weight="fill" aria-hidden="true" />
              Login with Telegram
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <span aria-hidden="true" className="h-px flex-1 bg-veyra-line" />
            <span>or continue with</span>
            <span aria-hidden="true" className="h-px flex-1 bg-veyra-line" />
          </div>

          <form action={login}>
            <button
              type="submit"
              className={`${loginButton} border border-veyra-line bg-white text-veyra-ink hover:border-veyra-cyan`}
            >
              <EnvelopeSimple size={18} weight="regular" aria-hidden="true" />
              Login with Email
            </button>
          </form>
        </section>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-8 -right-40 left-28 opacity-15 sm:left-52 lg:relative lg:inset-auto lg:h-[min(76dvh,760px)] lg:opacity-70"
        >
          <Image
            src="/assets/veyra-login-line-art.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-contain object-right-bottom"
            preload
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Add sign out to the existing account area**

Add this import to `src/components/overview-dashboard.tsx`:

```tsx
import { logout } from "@/app/actions";
```

Replace only the current account text block with:

```tsx
<div className="min-w-0">
  <strong className="block text-sm">Kaito Ren</strong>
  <span className="text-xs text-slate-500">{cycleLabel}</span>
  <form action={logout}>
    <button
      type="submit"
      className="mt-1 block text-xs font-semibold text-sky-700 transition-colors hover:text-veyra-navy motion-reduce:transition-none"
    >
      Sign out
    </button>
  </form>
</div>
```

Keep the avatar, section label, and surrounding responsive account layout
unchanged.

- [ ] **Step 9: Run the focused route and static checks**

Run:

```bash
node --test tests/demo-session.test.mjs tests/static.test.mjs tests/assets.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 10: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all tests PASS with no dashboard regressions.

- [ ] **Step 11: Run the production build**

Run:

```bash
npm run build
```

Expected: Next.js reports successful compilation and emits `/` and
`/dashboard` without TypeScript or route errors.

- [ ] **Step 12: Commit the login flow**

```bash
git add src/app/page.tsx src/app/actions.ts src/app/layout.tsx src/app/dashboard/page.tsx src/app/dashboard/loading.tsx src/components/overview-dashboard.tsx tests/static.test.mjs
git commit -m "feat: add Veyra demo login"
```

---

### Task 4: Verify the complete experience

**Files:**
- Verify: `src/app/page.tsx`
- Verify: `src/proxy.ts`
- Verify: `src/components/overview-dashboard.tsx`
- Verify: `public/assets/veyra-login-line-art.webp`
- Verify: existing user changes remain limited to `.dockerignore` and `docker-compose.yaml`

**Interfaces:**
- Consumes: the complete login, proxy, cookie actions, and dashboard route
- Produces: runtime, responsive, accessibility, and visual evidence for handoff

- [ ] **Step 1: Start the production server on an isolated local port**

Run in a dedicated terminal:

```bash
npm start -- --hostname 127.0.0.1 --port 3002
```

Expected: Next.js reports ready at `http://127.0.0.1:3002`.

- [ ] **Step 2: Verify the redirect table without a browser**

Run each command separately:

```bash
curl -I http://127.0.0.1:3002/dashboard
```

Expected: `307` with `location: /`.

```bash
curl -I --cookie "veyra_demo_session=active" http://127.0.0.1:3002/
```

Expected: `307` with `location: /dashboard`.

```bash
curl -I --cookie "veyra_demo_session=active" http://127.0.0.1:3002/dashboard
```

Expected: `200`.

```bash
curl -I --cookie "veyra_demo_session=invalid" http://127.0.0.1:3002/dashboard
```

Expected: `307` with `location: /`.

- [ ] **Step 3: Verify both reversible browser paths**

At `http://127.0.0.1:3002/`:

1. Use only the keyboard to reach **Login with Telegram**.
2. Activate it and confirm the URL becomes `/dashboard`.
3. Activate **Sign out** and confirm the URL returns to `/`.
4. Activate **Login with Email** and confirm the URL becomes `/dashboard`.
5. Close the browser session, reopen it, and confirm `/dashboard` redirects to
   `/`.

Expected: both login controls create the same browser-session flow, sign out
clears it, and no credential UI appears.

- [ ] **Step 4: Capture the approved visual sizes**

With the production server still running, capture the signed-out page:

```bash
npx playwright@1.61.1 screenshot --viewport-size="1440,900" http://127.0.0.1:3002/ screenshots/veyra-login-1440.png
```

```bash
npx playwright@1.61.1 screenshot --viewport-size="375,812" http://127.0.0.1:3002/ screenshots/veyra-login-375.png
```

Inspect both captures beside the login panel in
`/home/unmeii/.codex/attachments/a8cc8b95-8277-4eed-9e9d-3c9e3cfafd8a/Design 1.png`.

Expected at 1440×900: logo upper left, login card left of center, cyan technical
lines, and the line-art character on the right without obscuring the controls.

Expected at 375×812: one readable login column, subdued decorative artwork,
both buttons fully visible, and no horizontal crop of interactive content.

- [ ] **Step 5: Check responsive accessibility**

In the browser:

1. Set the viewport to 320px wide.
2. Increase text to 200%.
3. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
4. Tab through both login buttons and confirm the focus ring remains visible.
5. Emulate reduced motion and confirm no non-essential transition remains.
6. Inspect the accessibility tree and confirm the line-art image has no
   accessible name.

Expected: no content loss, no page-level horizontal scrolling, visible focus,
and no decorative image announcement.

- [ ] **Step 6: Run final automated verification**

Run:

```bash
npm test
```

```bash
npm run build
```

```bash
git diff --check
```

```bash
rg -n -i "jwt|jsonwebtoken|jose|next-auth|authjs" src package.json
```

Expected: tests and build PASS, `git diff --check` prints nothing, and the auth
dependency scan prints no matches.

- [ ] **Step 7: Confirm repository scope**

Run:

```bash
git status --short
```

Expected: no uncommitted login files remain. The pre-existing `.dockerignore`
and `docker-compose.yaml` modifications may remain and must not be staged,
changed, or committed by this plan.
