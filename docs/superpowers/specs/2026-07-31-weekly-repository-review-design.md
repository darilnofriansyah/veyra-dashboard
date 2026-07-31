# Weekly Repository Review Design

**Status:** Approved for implementation planning

## Scope

One scheduled task runs every Monday at 09:00 Asia/Jakarta and reviews:

- `/home/unmeii/apps/darilnofriansyah-landing-page`
- `/home/unmeii/apps/veyra`
- `/home/unmeii/apps/core-api`

## Output

The task updates `PROJECT_REVIEW.md` in each repository with:

- review date and reviewed commit;
- completed work;
- remaining tasks;
- needed improvements;
- concise summary.

## Review Method

Use repository state, recent commits, existing plans, TODOs, tests, and documentation as evidence. Preserve useful prior notes, replace stale generated findings, and distinguish evidence from inference.

## Safety

The task changes only each repository's `PROJECT_REVIEW.md`. If a repository cannot be read, report that failure without modifying its existing review document. It does not modify source code, commit, push, or deploy.

## Verification

Confirm all three files exist, contain all required sections, identify the reviewed commit, and show the current review date after a run.
