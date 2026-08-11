# Veyra

Veyra is a read-only financial dashboard. A signed-in user can inspect the
current and previous billing cycles, cash-flow totals, spending trends,
categories, budgets, recent transactions, alerts, and a combined credit-card
summary. Veyra does not create or edit financial records; it renders data from
the Core API.

Current work is tracked in [`BACKLOG.md`](BACKLOG.md) after the separate Task 3
backlog change is integrated. This README branch intentionally does not
duplicate that backlog, so the link is expected to be absent until integration.
Historical implementation plans are supporting records, not an active task
list.

## Prerequisites

- Node.js 24 and npm. CI and both Docker build stages use Node 24.
- Access to a compatible Core API instance.
- Telegram OIDC client credentials and an HTTPS origin for an actual sign-in.
- Docker with Compose if running the containerized service.

Install the locked dependency set from the repository root:

```bash
npm ci
```

## Configuration

Copy the checked-in environment template, then edit the copy without committing
credentials:

```bash
cp .env.example .env.local
```

The current `.gitignore` does not exclude `.env.local`, so keep it untracked and
check `git status` before staging changes.

Veyra supports these project-specific variables:

| Variable | Requirement | Purpose and validation |
| --- | --- | --- |
| `APP_URL` | Required | Public application origin used to build redirects and the Telegram callback. It must be a valid HTTPS URL; only its origin is used. |
| `TELEGRAM_CLIENT_ID` | Required | Telegram OIDC client ID. It must be a positive integer. |
| `TELEGRAM_CLIENT_SECRET` | Required | Server-only Telegram OIDC client secret used during the authorization-code exchange. |
| `AUTH_SECRET` | Required | Server-only key used to sign the OIDC flow and session JWTs. It must contain at least 32 characters. |
| `NEXUS_CORE_URL` | Optional | Base URL for Core. It defaults to `http://core-api:3000`; set it when Core is not reachable at that Docker-network address. Trailing slashes are removed. |
| `CORE_API_KEY` | Optional for Veyra; may be required by Core | When non-empty, Veyra sends it to Core as the server-only `x-core-api-key` header. |

Do not prefix these variables with `NEXT_PUBLIC_`: they are server-side
configuration. Do not commit `.env.local`, client secrets, API keys, SSH keys,
or the generated authentication secret.

`APP_URL` must remain HTTPS even during development because the authentication
configuration rejects an HTTP origin. To exercise Telegram login locally, put
the development server behind an HTTPS ingress or tunnel and set `APP_URL` to
that origin. Register this exact callback with the Telegram OIDC client:

```text
<APP_URL origin>/auth/telegram/callback
```

## Local development and verification

Start the Next.js development server on its default port, `3000`:

```bash
npm run dev
```

Run the Node test suite and production compilation separately:

```bash
npm test
npm run build
```

Run the compiled application on port `3000`:

```bash
npm start
```

`npm start` requires a completed `npm run build`. Environment configuration is
read at runtime when authentication or Core access is used.

The optional `npm run assets` command rewrites checked-in image derivatives; it
is a maintainer operation, not part of normal setup.

## Docker and Compose

The Compose project expects an existing external network named
`veyra-network`. Create it once if it is not already managed by the host:

```bash
docker network create veyra-network
```

Build and start Veyra with an explicit environment file:

```bash
docker compose --env-file .env.local up -d --build
docker compose --env-file .env.local ps
```

Stop the Compose project without deleting the external network:

```bash
docker compose --env-file .env.local down
```

The container listens on port `3000`. Compose publishes it only on the host
loopback interface as `127.0.0.1:3001`. The default Core URL assumes a service
reachable as `core-api:3000` on `veyra-network`; Core is not defined by this
Compose file.

## Core API boundary

Each dashboard load makes one uncached, server-side request to:

```text
POST <NEXUS_CORE_URL>/api/veyra/dashboard/overview
```

For a dashboard load, the JSON body contains the verified Telegram user ID,
the Jakarta calendar date, and the fixed `Asia/Jakarta` timezone:

```json
{
  "telegramUserId": "verified numeric Telegram ID",
  "asOfDate": "YYYY-MM-DD",
  "timezone": "Asia/Jakarta"
}
```

The login access check uses the same endpoint with `telegramUserId` and
`timezone`. Veyra adds `x-core-api-key` only when `CORE_API_KEY` is configured.
The request has a five-second timeout and is never made from browser code.

The response boundary requires `user`, `current`, and `previous`. Each cycle
must contain its period, transaction-presence flag, credit-card summary, totals,
comparison totals, daily spending, categories, budgets, and recent
transactions. The credit-card object requires non-negative safe-integer IDR
values named `limit`, `used`, and `statementBalance`. `current` must use the
`current_cycle` label and `previous` must use `previous_cycle`; dates, enums,
arrays, percentages, counts, and monetary values are validated before render.
The cycle `alert` may be missing or null while that Core field is pending.

Network failures, timeouts, non-success responses, invalid identities,
malformed JSON, and contract drift all become one safe unavailable state. The
dashboard displays a retry control and does not expose the upstream response.

## Telegram authentication

1. The login page links to `GET /auth/telegram`.
2. Veyra creates state, nonce, and PKCE values, stores them in a signed,
   HTTP-only, SameSite=Lax flow cookie for ten minutes, and redirects to
   Telegram OIDC.
3. Telegram returns to `GET /auth/telegram/callback`. Veyra verifies the signed
   flow, state, PKCE exchange, RS256 ID token, Telegram issuer, client audience,
   expiry, nonce, and numeric Telegram identity.
4. Veyra asks Core for that identity's overview as the access check. A success
   creates a signed, HTTP-only session JWT with a 12-hour token lifetime and
   redirects to `/dashboard`. Core `404` becomes `access_denied`; other failures
   return the generic `telegram_login` error and create no session.
5. The route guard redirects signed-in users from `/` to `/dashboard` and
   unsigned users in the opposite direction. The dashboard verifies the
   session again before passing the Telegram ID to Core.
6. Sign out runs the server action in `src/app/actions.ts`, deletes the session
   cookie, and redirects to `/`.

Session and flow cookies are marked `Secure` when `NODE_ENV` is `production`.
Telegram credentials, Core credentials, flow values, and session tokens must
not be logged or exposed to client components.

## CI and VPS deployment

The checked-in [GitHub Actions workflow](.github/workflows/deploy.yml) proves
the following repository configuration:

- Pull requests and pushes to `main` run on Node 24, then execute `npm ci`,
  `npm test`, and `npm run build`.
- A push to `main` deploys only after CI passes and uses the protected
  `production` GitHub environment with serialized production concurrency.
- Deployment requires the GitHub secrets `VPS_HOST`, `VPS_USER`,
  `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`.
- The remote script refuses a dirty production checkout, switches to `main`,
  pulls with `--ff-only`, and rebuilds Compose using the host-managed
  `/home/unmeii/apps/.env` file and project name `veyra`.
- The workflow checks HTTP reachability at `http://127.0.0.1:3001` up to 12
  times at five-second intervals. This is a root-page reachability check, not a
  dedicated application or dependency health endpoint.

Repository configuration alone does not prove the deployed revision, host
environment, secret presence, Telegram callback registration, Core
reachability, or a successful live login. Verify those externally without
printing secret values.

## Weekly repository review

[`docs/weekly-repository-review-prompt.md`](docs/weekly-repository-review-prompt.md)
is the bounded prompt for reviewing Veyra, Core API, and the related landing
page. It permits updates only to each repository's `PROJECT_REVIEW.md` and
forbids source changes, commits, pushes, deployments, and external mutations.

The historical scheduling plan specifies Monday at 09:00 Asia/Jakarta and a
log at `/tmp/weekly-repository-review.log`. Those repository files do not prove
that a user crontab entry is installed or that a recent run succeeded. The host
operator must verify the installed schedule and log separately; do not install
or alter cron as part of application deployment.

## Troubleshooting and ownership

- **Authentication configuration fails:** confirm `APP_URL` uses HTTPS,
  `TELEGRAM_CLIENT_ID` is a positive integer, `AUTH_SECRET` is at least 32
  characters, and the registered callback exactly matches the derived URL.
- **Telegram returns the generic login error:** check the callback, client
  secret, outbound access to Telegram token/JWKS endpoints, clock accuracy, and
  Core reachability. Veyra intentionally collapses sensitive failure details.
- **Access is denied:** Core returned `404` for the verified Telegram identity;
  user provisioning and authorization are owned by Core.
- **The overview is unavailable:** check Core DNS/network membership, the base
  URL, API-key policy, the five-second timeout, and response-contract drift.
- **Compose cannot start:** confirm `veyra-network` exists and that host port
  `3001` is free. If using the default URL, confirm Core is attached to the same
  network with the `core-api` name or alias.
- **Deployment stops before Compose:** the workflow deliberately refuses a dirty
  production checkout and a non-fast-forward pull. Inspect the host checkout;
  do not discard changes automatically.

Veyra owns browser rendering, Telegram OIDC/session handling, the server-side
Core request, and response validation. Core owns financial calculations, data,
user provisioning, and authorization. The production operator owns runtime
environment files, network wiring, deployed-revision evidence, and cron. Never
copy secrets into issues, logs, test fixtures, or review documents.
