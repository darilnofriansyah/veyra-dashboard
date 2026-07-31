# Weekly Repository Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one evidence-based review document per repository and refresh all three every Monday at 09:00 Asia/Jakarta.

**Architecture:** Store one shared review prompt in the Veyra development checkout. One user crontab entry invokes `codex exec` from Veyra, grants write access only to the other two repositories, and lets the agent update only the three review files.

**Tech Stack:** Markdown, Codex CLI, user crontab

## Global Constraints

- Review `/home/unmeii/apps/darilnofriansyah-landing-page`, `/home/unmeii/apps/veyra`, and `/home/unmeii/apps/core-api`.
- Run every Monday at 09:00 Asia/Jakarta.
- Update only `PROJECT_REVIEW.md` in each repository during scheduled runs.
- Never commit, push, deploy, or modify source code.
- Separate repository evidence from inference.

---

### Task 1: Shared Review Prompt

**Files:**
- Create: `/home/unmeii/apps/veyra/docs/weekly-repository-review-prompt.md`

**Interfaces:**
- Consumes: three absolute repository paths from Global Constraints
- Produces: instructions consumed by `codex exec` through stdin

- [ ] **Step 1: Write prompt**

Require each review to contain `Review Metadata`, `Completed Work`, `Remaining Tasks`, `Needed Improvements`, and `Summary`. Require current branch, commit, clean/dirty state, recent commits, existing plans, documentation, tests, and explicit task markers as evidence. Preserve useful prior notes, replace stale generated findings, and leave an existing file untouched when its repository cannot be read.

- [ ] **Step 2: Check prompt constraints**

Run:

```bash
rg -n 'PROJECT_REVIEW.md|Completed Work|Remaining Tasks|Needed Improvements|Summary|commit|push|deploy' docs/weekly-repository-review-prompt.md
```

Expected: required sections and safety restrictions present.

- [ ] **Step 3: Commit prompt**

```bash
git add docs/weekly-repository-review-prompt.md
git commit -m "docs: add weekly repository review prompt"
```

### Task 2: Initial Repository Reviews

**Files:**
- Create: `/home/unmeii/apps/darilnofriansyah-landing-page/PROJECT_REVIEW.md`
- Create: `/home/unmeii/apps/veyra/PROJECT_REVIEW.md`
- Create: `/home/unmeii/apps/core-api/PROJECT_REVIEW.md`

**Interfaces:**
- Consumes: current Git state, recent commits, plans, docs, tests, and task markers in each repository
- Produces: one independently reviewable status document per repository

- [ ] **Step 1: Collect evidence**

For each repository, inspect `git status --short`, `git rev-parse --short HEAD`, `git log -10 --oneline`, top-level documentation, active plans, and unchecked Markdown tasks.

- [ ] **Step 2: Write each review**

Use this exact structure:

```markdown
# Project Review

## Review Metadata

## Completed Work

## Remaining Tasks

## Needed Improvements

## Summary
```

Record review date `2026-07-31`, branch, commit, and dirty state. Keep findings concise and evidence-based.

- [ ] **Step 3: Verify all reviews**

Run:

```bash
for repo in darilnofriansyah-landing-page veyra core-api; do
  test -f "/home/unmeii/apps/$repo/PROJECT_REVIEW.md"
  rg -q '^## (Review Metadata|Completed Work|Remaining Tasks|Needed Improvements|Summary)$' "/home/unmeii/apps/$repo/PROJECT_REVIEW.md"
done
```

Expected: exit status 0.

- [ ] **Step 4: Commit reviews separately**

Commit `PROJECT_REVIEW.md` in each repository with message `docs: add project review` without staging unrelated changes.

### Task 3: Weekly Schedule

**Files:**
- Modify: current user's crontab

**Interfaces:**
- Consumes: `/home/unmeii/apps/veyra/docs/weekly-repository-review-prompt.md`
- Produces: weekly `codex exec` run and `/tmp/weekly-repository-review.log`

- [ ] **Step 1: Install one cron entry**

Preserve existing entries and add exactly:

```cron
0 9 * * 1 /home/unmeii/.local/bin/codex exec --ephemeral --sandbox workspace-write -C /home/unmeii/apps/veyra --add-dir /home/unmeii/apps/darilnofriansyah-landing-page --add-dir /home/unmeii/apps/core-api - < /home/unmeii/apps/veyra/docs/weekly-repository-review-prompt.md >> /tmp/weekly-repository-review.log 2>&1
```

Host timezone is WIB (`Asia/Jakarta`), so no schedule conversion is required.

- [ ] **Step 2: Verify installed schedule**

Run:

```bash
crontab -l | grep -F '0 9 * * 1 /home/unmeii/.local/bin/codex exec'
```

Expected: exactly one matching line.

- [ ] **Step 3: Final safety check**

Confirm the prompt limits writes to the three `PROJECT_REVIEW.md` files and Git shows no unexpected changes.
