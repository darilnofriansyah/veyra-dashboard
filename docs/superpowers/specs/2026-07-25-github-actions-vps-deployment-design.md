# GitHub Actions VPS Deployment Design

**Date:** 2026-07-25
**Status:** Approved for implementation planning

## Goal

Test every proposed change and automatically deploy pushes to `main` to the
existing VPS with GitHub Actions.

## Decision

Use one GitHub Actions workflow with separate CI and production deployment
jobs. CI will install dependencies, run the existing tests, and build the
Next.js application. The deployment job will run only for pushes to `main`
after CI succeeds.

Deployment will use SSH to update a dedicated production checkout at
`/home/unmeii/apps/veyra-production`, then rebuild and restart the existing
Docker Compose service. The current `/home/unmeii/apps/veyra` checkout will
remain available for development and will not be modified by deployments.

## Workflow

1. Pull requests and pushes to `main` run CI on a GitHub-hosted Ubuntu runner.
2. CI checks out the commit, installs Node.js 24 dependencies with `npm ci`,
   runs `npm test`, and runs `npm run build`.
3. A successful push to `main` starts the production deployment job.
4. The job connects to the VPS over SSH using GitHub environment secrets.
5. On the first deployment, the remote command clones `main` into
   `/home/unmeii/apps/veyra-production`. Later deployments fetch and fast-forward
   that checkout to `origin/main`.
6. The remote command runs `docker compose --project-name veyra up -d --build`.
   The explicit project name adopts the currently running `veyra` Compose
   service instead of creating a second service from the new directory name.
7. The deployment checks `http://127.0.0.1:3001` every five seconds for up to
   one minute. If every attempt fails, the workflow fails.

## GitHub Configuration

Create a `production` GitHub environment containing:

- `VPS_HOST`: VPS hostname or IP address
- `VPS_USER`: SSH user with access to the production directory and Docker
- `VPS_SSH_KEY`: private key dedicated to GitHub Actions deployment
- `VPS_KNOWN_HOSTS`: pinned `known_hosts` entry for the VPS

The workflow will use read-only repository permissions and a production
concurrency group so two deployments cannot run at the same time. A newer
deployment will wait instead of cancelling one that may already be restarting
the service.

## VPS Requirements

- Docker and Docker Compose are installed.
- The external Docker network `veyra-network` exists.
- The deployment user can run Docker without interactive elevation.
- The deployment user's public SSH key is present in `authorized_keys`.
- Port `3001` remains bound to loopback, as defined by the existing Compose
  file.
- The public GitHub repository is reachable from the VPS.

The current VPS already satisfies the Docker, Compose, network, running-service,
and GitHub-read-access requirements. SSH access from GitHub Actions must be
configured by adding the deployment key and repository environment secrets.

## Safety and Failure Handling

- CI failure prevents deployment.
- SSH host verification uses the pinned `VPS_KNOWN_HOSTS` secret; host-key
  checking will not be disabled.
- `git pull --ff-only` prevents deployments from overwriting unexpected changes
  in the production checkout.
- Shell commands stop on the first error.
- The explicit Compose project name preserves the existing container identity
  during the move to the dedicated production checkout.
- Compose keeps the existing container running if the new image fails to build.
- A failed post-deployment health check marks the deployment unsuccessful but
  does not add automatic rollback.

## Verification

1. Validate the workflow YAML.
2. Run `npm test`.
3. Run `npm run build`.
4. Confirm the remote deployment script is syntactically valid.
5. Push or merge a test commit to `main`.
6. Confirm the GitHub Actions CI and deployment jobs succeed.
7. Confirm the Compose service is running on the VPS and
   `http://127.0.0.1:3001` returns a successful response.

## Deferred

- Container registry publishing
- Immutable release images
- Automatic rollback
- Blue-green or zero-downtime deployment
- GitHub environment approval rules
- Nginx Proxy Manager, domain, and TLS changes
