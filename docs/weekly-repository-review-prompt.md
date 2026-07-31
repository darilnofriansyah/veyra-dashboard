Review these repositories:

- `/home/unmeii/apps/darilnofriansyah-landing-page`
- `/home/unmeii/apps/veyra`
- `/home/unmeii/apps/core-api`

Update only `PROJECT_REVIEW.md` at each repository root. Do not modify source code, other documentation, configuration, dependencies, Git state, branches, commits, remotes, deployments, or external systems.

For each repository, inspect current branch and commit, clean/dirty state, recent commits, top-level documentation, existing plans, tests, and explicit task markers. Treat unchecked boxes in historical implementation plans as weak evidence because completed plans may not have been checked off. Distinguish verified facts from inferred work.

Write this structure:

```markdown
# Project Review

## Review Metadata

- Reviewed: YYYY-MM-DD HH:MM Asia/Jakarta
- Branch: ...
- Commit: ...
- Working tree: clean, or concise list of pre-existing changes

## Completed Work

## Remaining Tasks

## Needed Improvements

## Summary
```

Keep every section concise, actionable, and supported by repository evidence. Preserve still-useful prior notes and replace stale generated findings. Never claim tests passed unless run during this review; name any tests run and their result.

Process repositories independently. If one cannot be read, leave its existing `PROJECT_REVIEW.md` untouched and continue with the others. At end, verify all successfully updated files contain every required heading. Report failures without broadening write scope.
