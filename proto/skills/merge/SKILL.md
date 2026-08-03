---
name: merge
description: Use this skill when working a wayfinder `merge` ticket — land the unit's branch on the trunk (`git merge --no-ff`), clean up, and close the unit. Must write the repo.
---

# `merge` — land a unit on the trunk (atomic)

**Role.** Merges the `development` unit branch → the trunk
`implement/<spec-slug>`. Only startable after an approved `unit-review`. Closes
the `development` ticket on completion.

**Atomic/composite:** atomic. **Closes when** the unit lands on the trunk (+ the
parent `development` + itself).

**Repo-write:** **must** write the repo — `git merge --no-ff` on the trunk (the
repo-write inversion inverted — #104).

**Flow:** `git checkout implement/<spec-slug>` → `git merge --no-ff <dev-branch>`
(merge commit carries the dev-ticket **title**) → on success: remove the dev
worktree, guarded `git branch -d`, push the trunk; on **hard** conflict: halt,
leave the merge in-progress, hand control to the user (never `--ours`/`--theirs`,
never commit with markers). Closes itself + the parent `development`.
