# Veyra Telegram OIDC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Veyra's demo login with production Telegram OIDC and issue a
signed dashboard session only for active Nexus Core users.

**Architecture:** Native Next.js Route Handlers own Authorization Code + PKCE,
Telegram callback validation, and cookies. `jose` verifies Telegram RS256
tokens and signs the temporary flow and application session JWTs. The existing
Nexus Core overview endpoint is the deny-first authorization boundary.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5.9, Node test runner,
Telegram OIDC, JOSE.

## Global Constraints

- Production origin is exactly `https://veyra.darilnofriansyah.my.id`.
- Callback is exactly
  `https://veyra.darilnofriansyah.my.id/auth/telegram/callback`.
- Request only `openid profile`.
- Unknown and inactive Nexus Core users receive no session.
- Never expose or log the Telegram client secret, Core API key, tokens, flow
  cookie, or session cookie.
- Keep Proxy optimistic; verify the session again beside dashboard data access.
- No database migration, Core endpoint, auth framework, email login, refresh
  flow, or persistent session store.
- Add only the `jose` runtime dependency.

---

### Task 1: Add tested OIDC and session primitives

**Files:**
- Create: `src/lib/auth.ts`
- Create: `tests/auth.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces:
  `createAuthorizationRequest(input?: Partial<AuthorizationInput>): Promise<{ url: URL; flowToken: string }>`
- Produces:
  `completeTelegramLogin(input: CallbackInput): Promise<TelegramIdentity>`
- Produces:
  `createSessionToken(identity: TelegramIdentity): Promise<string>`
- Produces:
  `verifySessionToken(token: string | undefined): Promise<Session | null>`
- Produces cookie names `OIDC_FLOW_COOKIE` and `SESSION_COOKIE`.

- [ ] **Step 1: Install the one required dependency**

Run:

```bash
npm install jose
```

Expected: `jose` appears under runtime `dependencies`.

- [ ] **Step 2: Write failing tests for authorization and signed state**

Create deterministic tests that inject `state`, `nonce`, and `codeVerifier`,
then assert:

```ts
assert.equal(url.origin, "https://oauth.telegram.org");
assert.equal(url.searchParams.get("redirect_uri"),
  "https://veyra.darilnofriansyah.my.id/auth/telegram/callback");
assert.equal(url.searchParams.get("scope"), "openid profile");
assert.equal(url.searchParams.get("code_challenge_method"), "S256");
```

Sign the flow token, verify it, then alter one character and assert verification
returns `null`.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
node --test tests/auth.test.ts
```

Expected: FAIL because `src/lib/auth.ts` does not exist.

- [ ] **Step 4: Implement authorization and signed JWT helpers**

Use `randomBytes(32).toString("base64url")` for state, nonce, and verifier.
Derive the S256 challenge with SHA-256. Use `SignJWT` and `jwtVerify` with
issuer `veyra`, audiences `veyra-oidc-flow` and `veyra-web`, explicit HS256,
and ten-minute/twelve-hour expirations.

Environment access stays inside functions:

```ts
interface AuthConfig {
  appUrl: string;
  clientId: string;
  clientSecret: string;
  authSecret: Uint8Array;
}
```

Validate that every value is non-empty and that `APP_URL` is HTTPS.

- [ ] **Step 5: Add failing Telegram-token verification tests**

Generate an RSA key pair with `jose`, create a local JWKS, and sign a Telegram
test ID token. Prove the verifier accepts only:

```ts
{
  iss: "https://oauth.telegram.org",
  aud: clientId,
  nonce,
  id: 976684739,
  name: "Kaito Ren"
}
```

Add one table-driven test that rejects wrong issuer, audience, nonce, expired
token, non-RS256 token, and a missing/non-numeric/non-positive `id`.

- [ ] **Step 6: Run the tests and verify RED**

Run:

```bash
node --test tests/auth.test.ts
```

Expected: FAIL because Telegram ID-token verification is not implemented.

- [ ] **Step 7: Implement token exchange and ID-token verification**

Use:

```ts
const TELEGRAM_JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);
```

Call `jwtVerify()` with issuer, audience, `algorithms: ["RS256"]`, and required
claims. Compare nonce after signature verification. Exchange the code through
`https://oauth.telegram.org/token` using Basic authentication,
`grant_type=authorization_code`, the exact redirect URI, client ID, and stored
PKCE verifier.

- [ ] **Step 8: Add and satisfy Core authorization tests**

Inject a fake `fetch` and assert:

- `telegramUserId` is the only identity in the Core request.
- `404` returns `access_denied`.
- other non-success/network failures return `telegram_login`.
- no failure creates a session token.

The production implementation calls the existing overview endpoint with
`cache: "no-store"` and a five-second timeout, and ignores a successful body.

- [ ] **Step 9: Run the focused tests**

Run:

```bash
node --test tests/auth.test.ts
```

Expected: PASS with no network access.

### Task 2: Add the production login and callback routes

**Files:**
- Create: `src/app/auth/telegram/route.ts`
- Create: `src/app/auth/telegram/callback/route.ts`
- Modify: `src/app/page.tsx`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes `createAuthorizationRequest()` and `completeTelegramLogin()`.
- Produces GET routes `/auth/telegram` and `/auth/telegram/callback`.

- [ ] **Step 1: Write failing static route/UI checks**

Assert the login page links to `/auth/telegram`, contains no demo server action
or email form, and renders safe `access_denied` and `telegram_login` messages.
Assert both route files exist and reference the flow/session cookies.

- [ ] **Step 2: Run static tests and verify RED**

Run:

```bash
node --test tests/static.test.mjs
```

Expected: FAIL because the Telegram routes do not exist and the page still uses
the demo action.

- [ ] **Step 3: Implement the start route**

Return a redirect response to the generated Telegram authorization URL. Set the
signed flow cookie with:

```ts
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/auth/telegram/callback",
  maxAge: 600
}
```

- [ ] **Step 4: Implement the callback route**

Always expire the one-time flow cookie. On success set the signed session cookie
as HTTP-only, secure, SameSite=Lax, path `/`, with no persistent max-age, then
redirect to `/dashboard`. Map every provider/validation/upstream failure to
`/?error=access_denied` or `/?error=telegram_login` without logging secrets.

- [ ] **Step 5: Replace the demo login UI**

Use an accessible link styled as the existing primary button. Make the page
async and map only the two recognized error codes to fixed copy. Remove the
separator and email button.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test tests/auth.test.ts tests/static.test.mjs
```

Expected: PASS.

### Task 3: Protect the dashboard with the verified session identity

**Files:**
- Delete: `src/lib/demo-session.ts`
- Replace: `tests/demo-session.test.mjs`
- Modify: `src/proxy.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/lib/overview-loader.ts`
- Modify: `tests/overview-loader.test.ts`
- Modify: `src/components/overview-dashboard.tsx`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Dashboard page consumes `getSession()` and calls
  `loadOverview(asOfDate, session.telegramUserId)`.
- Loader produces the existing `OverviewLoaderResult`.

- [ ] **Step 1: Write failing loader identity tests**

Change the focused request assertion to:

```ts
await loadOverview("2026-07-25", "976684739", fetchImpl);
assert.deepEqual(JSON.parse(String(request.init?.body)), {
  telegramUserId: "976684739",
  asOfDate: "2026-07-25",
  timezone: "Asia/Jakarta"
});
```

Assert invalid Telegram identifiers return the safe error result and no request
is sent. Remove tests for fixed identity defaults.

- [ ] **Step 2: Run loader tests and verify RED**

Run:

```bash
node --test tests/overview-loader.test.ts
```

Expected: FAIL because the loader still reads fixed identity environment
variables.

- [ ] **Step 3: Pass the session identity to Core**

Change the loader signature to:

```ts
loadOverview(
  asOfDate: string,
  telegramUserId: string,
  fetchImpl: typeof fetch = fetch
): Promise<OverviewLoaderResult>
```

Validate the identifier as a positive numeric string, remove the fixed defaults,
and omit `userId` from the Core body.

- [ ] **Step 4: Write failing proxy/session tests**

Create a real signed session token, await the async Proxy, and prove:

- missing/tampered/expired cookies redirect `/dashboard` to `/`;
- a valid cookie allows `/dashboard`;
- a valid cookie redirects `/` to `/dashboard`;
- the matcher remains `["/", "/dashboard"]`.

- [ ] **Step 5: Run proxy tests and verify RED**

Run:

```bash
node --test tests/demo-session.test.mjs
```

Expected: FAIL because Proxy still accepts the fixed demo value.

- [ ] **Step 6: Replace the demo session guard**

Make Proxy async and call `verifySessionToken()` on the request cookie. In the
dashboard page, call `getSession()` again and redirect when absent before
calling Core.

Keep logout as the existing Server Action, but delete the real session cookie
instead of the demo cookie.

- [ ] **Step 7: Display the verified Telegram name**

Pass `session.name` into `OverviewDashboard`. Render the display name and
initials with a `Telegram user` fallback. Do not load external profile images.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test tests/auth.test.ts tests/demo-session.test.mjs tests/overview-loader.test.ts tests/static.test.mjs
```

Expected: PASS.

### Task 4: Wire production environment and deployment

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yaml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Compose consumes named variables from
  `/home/unmeii/apps/.env`.

- [ ] **Step 1: Write failing environment/deployment checks**

Require `.env.example` and Compose to contain:

```txt
APP_URL
TELEGRAM_CLIENT_ID
TELEGRAM_CLIENT_SECRET
AUTH_SECRET
NEXUS_CORE_URL
CORE_API_KEY
```

Reject `VEYRA_TELEGRAM_USER_ID`, `VEYRA_USER_ID`, and every `NEXT_PUBLIC_`
credential. Require the deploy command to include:

```txt
--env-file /home/unmeii/apps/.env
```

- [ ] **Step 2: Run static tests and verify RED**

Run:

```bash
node --test tests/static.test.mjs
```

Expected: FAIL because the auth variables and explicit global env loading are
not configured.

- [ ] **Step 3: Update the environment contract**

Document empty secret placeholders in `.env.example`. Pass only the six named
variables through Compose. Update the production deployment command to load the
global env file explicitly before `--project-directory`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test tests/static.test.mjs
```

Expected: PASS.

### Task 5: Full verification and review

**Files:**
- Review every file changed above.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all tests pass, zero failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: build exits zero without making live Telegram or Nexus Core requests.

- [ ] **Step 3: Run repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only planned authentication, environment, test,
dependency, and documentation changes are present.

- [ ] **Step 4: Self-review security and scope**

Confirm:

- callback URL exactly matches BotFather;
- state, nonce, PKCE, signature, issuer, audience, expiry, algorithm, and
  Telegram numeric ID are checked;
- no failure path sets a session;
- no secret is client-visible or logged;
- dashboard data access verifies the session independently of Proxy;
- only the verified Telegram ID reaches Core;
- unknown/inactive users receive no session;
- demo authentication and fixed identities are gone;
- no unrelated abstraction, provider, database, or staging work was added.
