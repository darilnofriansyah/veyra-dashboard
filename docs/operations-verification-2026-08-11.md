# Operations verification — 2026-08-11

**Checked:** 2026-08-11T19:25:28+07:00 (Asia/Jakarta)
**Scope:** Read-only evidence collection for the Veyra deployment, runtime, Core connectivity, public auth-route status, deployment automation, environment-name presence, and weekly-review cron. No production repositories, configuration, services, GitHub state, cron, requests with bodies, or login flows were changed; the only write was creation of this report in the isolated review worktree.

## Claim summary

| Claim | Status | Evidence | Owner |
| --- | --- | --- | --- |
| Production checkout is present and clean on `main` | Verified | `/home/<account>/apps/veyra-production` exists; `git status --short` was empty; `HEAD` and `origin/main` were `dc04ea5` | Infrastructure maintainer |
| Review baseline can be compared by Git ancestry | Blocked | Baseline `1ebb184` is not present in the production checkout's object database; direct ancestor/divergence calculation was not possible | Deployment owner |
| Latest GitHub deployment workflow completed successfully | Verified | Latest `CI and deploy` push run: completed/success; `headSha` `dc04ea5`; created 2026-07-30T02:07:31Z and updated 2026-07-30T02:09:11Z | Deployment owner |
| Veyra is running; local root responded HTTP 200 | Verified | Veyra app container running; loopback `3001 -> 3000`; status-only `GET /` on the loopback endpoint returned HTTP 200 | Infrastructure maintainer |
| Configured public root is reachable | Verified | Status-only request to the configured public root returned HTTP 200 | Infrastructure maintainer |
| Telegram OIDC flow works end-to-end | Unverified | Start and empty-callback routes returned redirects, but no identity-provider interaction, credentials, callback parameters, or login was performed | Veyra auth owner |
| Core is reachable from the Veyra container | Verified | Status-only TCP probe using the container's configured Core URL reported reachable | Nexus Core / infrastructure owner |
| Authorized Core overview request succeeds | Unverified | No key, Telegram identifier, request body, response body, or financial data was used or inspected | Nexus Core owner |
| Weekly review is scheduled for Monday 09:00 Asia/Jakarta | Verified | One matching crontab entry uses `0 9 * * 1`; host timezone reported `Asia/Jakarta`; its working directory and prompt path target the Veyra repository | Automation owner |

Status meanings: **Verified** = directly observed during this check; **Repository-only** = source/config review only; **Unverified** = intentionally not exercised; **Blocked** = evidence could not be obtained safely from the available state.

## Revision, deployment, and runtime

- Isolated review worktree: `codex/veyra-week-5-operations-verification` at `1ebb184`.
- Production checkout: `main` at `dc04ea5`, with `origin/main` at the same revision. Its origin was confirmed as the Veyra dashboard GitHub repository; the report intentionally omits the account portion of the URL.
- The two revisions are different, but the production clone does not contain object `1ebb184`, so no ancestry or commit-count claim is made.
- Repository-only deployment evidence from `.github/workflows/deploy.yml`: pushes to `main` run `npm ci`, tests, and build before the production deployment job; deployment requires a clean checkout, fast-forwards `main`, runs Compose with `/home/<account>/apps/.env`, and polls the loopback root endpoint.
- Veyra app container: state `running`, started 2026-07-30T02:09:02Z. Published port is loopback-only `127.0.0.1:3001 -> 3000/tcp`.
- Core container: state `running`; it has no host-published port (`3000/tcp` is internal only).
- Both application containers are attached to the external application network. No container environment dump, IP address, or secret-bearing configuration was collected.
- Status-only HTTP probes: local root HTTP 200 and configured public HTTPS root HTTP 200. Response bodies and headers were discarded.

## Expected environment-name presence

The matrix below is limited to the six variable names documented in `.env.example`. `/home/<account>/apps/.env` was read only to classify those names as non-empty (`set`) or absent/empty (`missing`); no values, lengths, hashes, encodings, comments, or unexpected names were recorded.

| Expected name | Presence |
| --- | --- |
| `APP_URL` | Set |
| `AUTH_SECRET` | Set |
| `CORE_API_KEY` | Set |
| `NEXUS_CORE_URL` | Missing |
| `TELEGRAM_CLIENT_ID` | Set |
| `TELEGRAM_CLIENT_SECRET` | Set |

Repository-only Compose evidence (`docker-compose.yaml`): Veyra receives these six names, and `NEXUS_CORE_URL` has an internal Core-service default when the host variable is absent. This is configuration-structure evidence, not validation of any effective value or credential.

## Telegram and Core boundary

- Repository-only: `/auth/telegram` creates an authorization redirect and a secure, HTTP-only, Lax flow cookie scoped to `/auth/telegram/callback`; the callback clears the flow cookie and creates a session only after an authorized result.
- Public status-only probes: `/auth/telegram` returned HTTP 307, and `/auth/telegram/callback` with no callback inputs returned HTTP 307. Redirect locations, query strings, cookies, and bodies were not captured.
- Repository-only: the overview loader issues a server-side POST to `/api/veyra/dashboard/overview`, applies a five-second timeout, and conditionally uses the server-only `x-core-api-key` header. Its required request body contains an identity value, so it was not exercised.
- Verified: a five-second TCP connection attempt from the Veyra container to its configured Core host/port succeeded. This establishes network reachability only; it does not establish API authentication, authorization, route behavior, or data correctness.

## Workflow, cron, and sanitized log evidence

- GitHub CLI was already configured; the latest queried run was `CI and deploy`, event `push`, completed with conclusion `success`, for `dc04ea5`. The query was read-only and did not alter authentication.
- The user crontab contains exactly one weekly-review entry matching the Veyra prompt path. It invokes the local Codex executable at `0 9 * * 1`, uses the Veyra checkout as working directory, adds the landing-page and Core repositories, and appends output to `/tmp/weekly-repository-review.log`.
- The crontab has no `CRON_TZ` override. The host timezone directly observed during this check was `Asia/Jakarta`, so this schedule is Monday 09:00 local host time.
- Sanitized log inspection only: `/tmp/weekly-repository-review.log` was 345,428 bytes, last modified 2026-08-10T09:06:42+07:00, with 5,818 lines. Aggregate token counts were 100 lines containing an error/failure term and 153 lines containing a completion/success term. No log lines were retained or quoted; these generic counts do not diagnose a job outcome.

## Gaps and safe next actions

| Gap | Status | Owner | Safe next action |
| --- | --- | --- | --- |
| Production revision cannot be ancestry-compared to review baseline | Blocked | Deployment owner | Ensure the production clone has the reviewed commit history, then run a read-only ancestor/divergence check. |
| Effective environment semantics remain unknown | Unverified | Infrastructure / Veyra auth owner | Validate values through a controlled deployment or secret-management review; do not print them. |
| Telegram provider registration and complete callback/session flow | Unverified | Veyra auth owner | Use a dedicated authorized test identity in a controlled session and record only status outcomes. |
| Core API authorization and overview response | Unverified | Nexus Core owner | Perform an approved non-production smoke test with a non-sensitive fixture identity; retain status-only results. |
| Weekly log outcome | Unverified | Automation owner | Review the log in an approved secret-safe channel, or add structured, non-sensitive success/failure output to the job. |
