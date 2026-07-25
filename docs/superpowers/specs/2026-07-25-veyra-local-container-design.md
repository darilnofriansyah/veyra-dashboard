# Veyra Local Container Design

**Date:** 2026-07-25
**Status:** Approved for implementation planning

## Goal

Run the existing Next.js application as a production container and make it
available locally at `http://127.0.0.1:3001`.

## Decision

Add a multi-stage `Dockerfile`, `.dockerignore`, and `docker-compose.yaml`.
Compose will build one `veyra` service, map host port `3001` to container port
`3000`, and attach it to the existing external `veyra-network`.

No reverse-proxy container will be added. Nginx Proxy Manager already owns ports
80 and 443 on the host. When public routing is needed, its proxy host can target
`veyra:3000` over `veyra-network` without changing or rebuilding the app.

## Runtime Flow

1. Docker installs dependencies and runs `npm run build`.
2. The runtime image starts the production server with `npm start`.
3. Local requests to `127.0.0.1:3001` reach port `3000` in the container.
4. A future Nginx Proxy Manager route can reach the same port by service name.

The application has no database, cache, worker, API, volume, or environment-file
dependency. Its dashboard data comes from checked-in fixtures.

## Failure Handling

- The image build must stop if dependency installation or the Next.js build
  fails.
- The container uses `restart: unless-stopped`.
- The local port binds to `127.0.0.1` so it is not exposed on every host
  interface before the proxy is configured.
- Compose will report a clear error if the required external
  `veyra-network` does not exist.

## Verification

This is configuration-only work, so runtime checks replace unit-test-first
development:

1. `docker compose config`
2. `docker compose build`
3. `docker compose up -d`
4. Confirm the container is running.
5. Confirm `http://127.0.0.1:3001` returns HTTP 200.
6. Run the existing test suite and production build outside Docker.

## Deferred

- Nginx Proxy Manager host, domain, and TLS configuration
- Container registry publishing
- Deployment automation
- Additional services or persistent volumes
