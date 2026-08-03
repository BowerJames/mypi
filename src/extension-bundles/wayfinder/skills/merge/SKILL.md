---
name: merge
description: Wayfinder implementation — a wayfinder:merge atomic. Land the unit branch on the trunk with --no-ff, clean up the worktree and branch, push the trunk, then self-close. Must write the repo.
---

# Wayfinder — `merge` (land a unit)

## Facts

- **Type:** `wayfinder:merge` — **atomic**.
- **Close:** **self** — after the unit lands on the trunk and cleanup is done. (The `development` round(s) already self-closed at their own commit; `merge` does not touch them. The `unit-map` composite closes via its own all-children + merge-landed check.)
- **Repo write:** **must** — a merge commit on the trunk.
- **Spawns:** nothing (spawned only by a passing `unit-review`'s gate, so "merge after approved review" holds by construction).

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:merge`**. It lands **one unit's branch** on the integration trunk.

## Land the unit (git ops, in the cwd repo)

The cwd repo holds `implement/<spec-slug>` checked out; unit branches are linked worktrees sharing its object store, so the unit branch is visible there.

1. **`git checkout implement/<spec-slug>`**, then **`git merge --no-ff dev/<spec-slug>/<n>-<slug>`**. `--no-ff` always makes a merge commit (carrying the unit-ticket **title** in the message) so each landing is a traceable node — **not** `--ff-only` (no marker) and **not** `--squash` (loses per-commit history).
2. **Cleanup on success:** remove the unit worktree (`git worktree remove <path>`), delete the merged unit branch with the **guarded `-d`** (`git branch -d dev/<spec-slug>/<n>-<slug>` — refuses if anything is unmerged), and **push the trunk** (`git push <remote> implement/<spec-slug>` on github/gitlab; no-op on local). Conditionally delete a pushed remote unit branch only if one was ever pushed (dev work is local-first). Net: no stray worktree or branch — only the merge commit remains.
3. **Comment + self-close.** Comment the merge SHA + what landed + cleanup done, then close this `merge` ticket.

## Conflicts — trivial vs hard

- **Trivial → resolve with certainty and no semantic judgment** (disjoint additions to different files; or one side clearly supersedes the other): edit, stage (`git add`), and `git commit` to continue.
- **Hard → halt and ask, never guess.** Stop without resolving, **leave the merge in-progress** (do **not** `git merge --abort` — that throws away the merge context), list the conflicted files + their conflict markers, and hand control to the user to resolve and commit (then re-run `/wayfinder <merge>` to finish). **Never** `--ours` / `--theirs` to force a side, and **never** commit while conflict markers remain.

## Closure is asymmetric by intent

`merge` closes itself; it does **not** close the `development` round (that self-closed at commit-time) or the `unit-review` (that self-closed at its gate). The `unit-map` composite closes when its runtime close-check sees all children closed **and** this merge landed. The `implementation-map` is untouched until `implementation-review`.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**. Read `unit-review` (what approved this) and `implementation-review` (the terminal review of the whole trunk) for foresight.
