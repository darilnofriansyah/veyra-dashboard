# GitHub Actions VPS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test pull requests and automatically deploy successful pushes to `main` to the existing VPS.

**Architecture:** One GitHub Actions workflow runs the existing Node.js checks, then uses native SSH to update a dedicated production checkout and rebuild the existing Docker Compose project. This configuration-only change is validated directly and through the existing test and production build commands.

**Tech Stack:** GitHub Actions, Node.js 24, npm, OpenSSH, Git, Docker Compose

## Global Constraints

- Deploy only successful pushes to `main`.
- Keep `/home/unmeii/apps/veyra` available for development.
- Use `/home/unmeii/apps/veyra-production` as the production checkout.
- Use the existing `veyra` Compose project and external `veyra-network`.
- Keep port `3001` bound to loopback.
- Use pinned SSH host keys; do not disable host verification.
- Use only official GitHub actions and native runner commands.
- Do not add a container registry, rollback system, or reverse proxy changes.

---

### Task 1: Add CI and VPS deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `docs/superpowers/plans/2026-07-25-github-actions-vps-deployment.md`

**Interfaces:**
- Consumes: `package-lock.json`, `npm test`, `npm run build`, GitHub `production` environment secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`
- Produces: CI for pull requests and pushes to `main`; serialized production deployments to Compose project `veyra`; a one-minute HTTP health check for `127.0.0.1:3001`

- [x] **Step 1: Add the minimal GitHub Actions workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: CI and deploy

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: ci
    runs-on: ubuntu-latest
    environment: production
    concurrency:
      group: production
      cancel-in-progress: false
    steps:
      - name: Configure SSH
        env:
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
          VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_deploy
          chmod 600 ~/.ssh/id_deploy
          printf '%s\n' "$VPS_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Deploy
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
        run: |
          ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -i ~/.ssh/id_deploy "$VPS_USER@$VPS_HOST" 'bash -se' <<'DEPLOY'
          set -euo pipefail
          repo=/home/unmeii/apps/veyra-production

          if [ ! -d "$repo/.git" ]; then
            git clone --branch main --single-branch https://github.com/darilnofriansyah/veyra-dashboard.git "$repo"
          fi

          if [ -n "$(git -C "$repo" status --porcelain)" ]; then
            echo "Production checkout is not clean: $repo" >&2
            exit 1
          fi

          git -C "$repo" switch main
          git -C "$repo" pull --ff-only origin main
          docker compose --project-directory "$repo" --project-name veyra up -d --build

          for attempt in {1..12}; do
            if curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3001; then
              exit 0
            fi
            sleep 5
          done

          docker compose --project-directory "$repo" --project-name veyra ps
          exit 1
          DEPLOY
```

- [x] **Step 2: Validate the project and workflow requirements**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all existing tests, the Next.js production build, and the whitespace
check pass. GitHub performs the final workflow-schema validation when the
committed workflow is pushed.

- [x] **Step 3: Document the required GitHub environment values**

Use these values when creating the GitHub `production` environment:

```text
VPS_HOST=<public VPS hostname or IP>
VPS_USER=unmeii
VPS_SSH_KEY=<private half of a dedicated deployment key>
VPS_KNOWN_HOSTS=<output of ssh-keyscan for VPS_HOST, verified against the VPS host key>
```

Add the matching public deployment key as one line in
`/home/unmeii/.ssh/authorized_keys` on the VPS. Do not commit either key or the
host/IP values.

- [x] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml docs/superpowers/plans/2026-07-25-github-actions-vps-deployment.md
git commit -m "ci: deploy main to VPS"
```
