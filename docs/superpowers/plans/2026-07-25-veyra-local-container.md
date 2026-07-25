# Veyra Local Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the existing Next.js application in Docker at `http://127.0.0.1:3001`.

**Architecture:** Build the application in a Node 24 Alpine stage, install only production dependencies in the runtime stage, and run `next start` as the unprivileged `node` user. Compose publishes the app only on loopback and joins the existing external `veyra-network` for later Nginx Proxy Manager routing.

**Tech Stack:** Docker, Docker Compose, Node.js 24 Alpine, Next.js 16

## Global Constraints

- Do not add another reverse proxy.
- Bind host port `3001` only to `127.0.0.1`.
- Keep the container reachable as `veyra:3000` on `veyra-network`.
- Do not add databases, volumes, environment files, registries, or deployment automation.
- This configuration-only change uses Compose/build/runtime checks instead of a unit-test-first cycle, as approved in the design.

---

### Task 1: Containerize and start Veyra

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yaml`

**Interfaces:**
- Consumes: `package.json`, `package-lock.json`, the Next.js build, and external Docker network `veyra-network`
- Produces: container service `veyra`, internal endpoint `veyra:3000`, and local endpoint `http://127.0.0.1:3001`

- [x] **Step 1: Add the production image**

Create `Dockerfile`:

```dockerfile
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

CMD ["npm", "start"]
```

- [x] **Step 2: Exclude local and development artifacts**

Create `.dockerignore`:

```text
.git
.next
.superpowers
node_modules
screenshots
tmp
*.tsbuildinfo
```

- [x] **Step 3: Add the single-service Compose file**

Create `docker-compose.yaml`:

```yaml
services:
  veyra:
    build: .
    container_name: veyra
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    networks:
      - veyra-network

networks:
  veyra-network:
    external: true
```

- [x] **Step 4: Validate Compose**

Run: `docker compose config`

Expected: exit code 0; resolved service `veyra` publishes `127.0.0.1:3001` to container port `3000` and uses external network `veyra-network`.

- [x] **Step 5: Run existing checks**

Run: `npm test && npm run build`

Expected: exit code 0 with all Node tests passing and a successful Next.js production build.

- [x] **Step 6: Build and start the container**

Run: `docker compose up -d --build`

Expected: exit code 0 and container `veyra` is created and started.

- [x] **Step 7: Verify the runtime**

Run:

```bash
docker compose ps
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3001
```

Expected: service `veyra` is running and `curl` exits 0 after receiving HTTP 200.

- [x] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yaml docs/superpowers/plans/2026-07-25-veyra-local-container.md
git commit -m "feat: run Veyra with Docker Compose"
```
