# Veyra Telegram OIDC Design

**Date:** 2026-07-26
**Status:** Approved
**Surface:** Production web login and authenticated dashboard

## 1. Purpose

Replace the demo login cookie with production Telegram OpenID Connect for
`https://veyra.darilnofriansyah.my.id`.

Telegram represents Veyra through `@veyra811_bot`. BotFather already allows:

- Trusted origin: `https://veyra.darilnofriansyah.my.id`
- Redirect URI:
  `https://veyra.darilnofriansyah.my.id/auth/telegram/callback`

Only Telegram users that resolve to an active `telegram_users` row in Nexus
Core may receive a Veyra session. Unknown and inactive users are denied.

## 2. Architecture

Use Telegram's OpenID Connect Authorization Code flow with PKCE. Next.js owns
the browser redirect, callback, and signed browser session. Nexus Core remains
the authority for whether the verified Telegram identity may access financial
data.

```text
Login page
  -> GET /auth/telegram
  -> Telegram OIDC (openid profile, PKCE, state, nonce)
  -> GET /auth/telegram/callback
  -> exchange code server-side
  -> verify Telegram ID token against JWKS
  -> authorize numeric Telegram id through Nexus Core
  -> set signed HTTP-only Veyra session
  -> /dashboard
```

The implementation uses native Next.js Route Handlers, `fetch`, `cookies`,
Web Crypto/Node crypto, and one runtime dependency: `jose`. `jose` verifies
Telegram's RS256 ID token and signs the Veyra HS256 session and temporary OIDC
flow cookie.

## 3. OIDC configuration

Server-only environment:

```txt
APP_URL=https://veyra.darilnofriansyah.my.id
TELEGRAM_CLIENT_ID=<BotFather Web Login client id>
TELEGRAM_CLIENT_SECRET=<BotFather Web Login client secret>
AUTH_SECRET=<at least 32 bytes of random secret material>
```

Existing `NEXUS_CORE_URL` and `CORE_API_KEY` remain server-only.

Authorization request:

- Authorization endpoint: `https://oauth.telegram.org/auth`
- Response type: `code`
- Scope: `openid profile`
- PKCE: `S256`
- Unique random `state`
- Unique random `nonce`
- Exact redirect URI: `${APP_URL}/auth/telegram/callback`

The temporary flow values are stored in one signed, HTTP-only, secure,
SameSite=Lax cookie scoped to the callback path and expiring after ten minutes.

## 4. Callback validation

The callback must reject the request unless all of the following succeed:

1. Telegram returned a code and the original state.
2. The signed flow cookie is valid and unexpired.
3. Returned state exactly matches the stored state.
4. The code exchange succeeds using HTTP Basic client authentication and the
   stored PKCE verifier.
5. The ID token has an RS256 signature trusted by Telegram's JWKS.
6. `iss` equals `https://oauth.telegram.org`.
7. `aud` matches `TELEGRAM_CLIENT_ID`.
8. `exp` is valid.
9. `nonce` matches the stored nonce.
10. The `profile` claim contains a positive numeric Telegram `id`.

The decoded-but-unverified callback `user` object is never trusted.

## 5. Nexus Core authorization

After Telegram verification and before creating a session, Veyra calls:

```http
POST /api/veyra/dashboard/overview
x-core-api-key: <CORE_API_KEY>
content-type: application/json

{
  "telegramUserId": "<verified Telegram id>",
  "timezone": "Asia/Jakarta"
}
```

Nexus Core now resolves only `telegram_users.is_active IS TRUE`.

- Any successful response authorizes the identity.
- `404` denies the login with a generic access-denied message.
- Network errors, timeouts, and other non-success responses produce a generic
  temporary login failure and do not create a session.

This reuses the existing Core contract and avoids a speculative identity
endpoint. The overview response is intentionally ignored during login. A
dedicated lightweight endpoint is warranted only if login traffic makes the
extra overview calculation measurable.

## 6. Session

Veyra issues a signed HS256 JWT containing:

- `telegramUserId`
- Telegram display `name` when available
- issuer `veyra`
- audience `veyra-web`
- issued-at time
- twelve-hour expiration

The cookie is:

- HTTP-only
- secure in production
- SameSite=Lax
- path `/`
- a browser-session cookie with no persistent `maxAge`

Proxy performs only an optimistic cryptographic session check. The dashboard
page repeats the session verification before calling Nexus Core. The dashboard
loader sends only the session's verified `telegramUserId`; the fixed
`VEYRA_TELEGRAM_USER_ID` and `VEYRA_USER_ID` configuration is removed.

Logout deletes the Veyra session cookie. No Telegram-wide logout or token
revocation is attempted.

## 7. UI and errors

The Telegram button becomes a normal link to `/auth/telegram`.

The unimplemented email login control is removed rather than continuing to
create a fake session.

The login page supports two safe error states:

- `access_denied`: the Telegram account does not have access to Veyra.
- `telegram_login`: Telegram login could not be completed; retry later.

Provider error details, tokens, secrets, Core response bodies, and user
financial data are never rendered or logged.

The dashboard account label uses the verified Telegram display name when
available and falls back to `Telegram user`.

## 8. Deployment

The production deploy command must explicitly load
`/home/unmeii/apps/.env`. Compose passes only the named Veyra variables into
the application container; it must not import the entire global environment.

No staging URL, database migration, new Nexus Core endpoint, email
authentication, phone-number permission, bot messaging permission, refresh
token flow, or persistent session store is included.

## 9. Testing

The smallest useful test set proves:

1. PKCE and the authorization URL use the exact production callback and
   `openid profile`.
2. Signed flow cookies and sessions reject tampering and expiration.
3. Telegram ID-token validation enforces signature, issuer, audience, nonce,
   expiry, RS256, and a positive numeric `id`.
4. Code exchange sends the stored PKCE verifier and keeps credentials in HTTP
   Basic authentication.
5. Nexus Core `404` denies login and other upstream failures do not authorize.
6. Proxy redirects based on a cryptographically valid session.
7. Dashboard loading sends only the verified session Telegram ID.
8. Static checks keep secrets server-only, remove demo authentication, preserve
   accessibility, and load the global production environment explicitly.
9. The full Node test suite and production Next.js build pass without live
   Telegram or Nexus Core requests.
