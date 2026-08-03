---
name: development
description: Use this skill when working a wayfinder `development` ticket — one isolated coding round on the unit's branch (round 1 and rework are the same primitive); must write the repo.
---

# `development` — one coding round (atomic)

**Role.** One isolated unit of dev on the unit's shared branch. **Reclassified
composite→atomic in #107:** round 1 **and** rework are the **same** primitive —
`follow-up-development` is deleted. On completion spawns a `unit-review`.

**Atomic/composite:** atomic. **Closes when** the work is committed (it stays
open as the unit anchor until `merge` lands it; rework just re-opens the work
on the same branch, it is not a different ticket).

**Repo-write:** **must** write the repo (the repo-write inversion, inverted —
#104). Materialise the dev branch + worktree lazily on first work
(`git branch` + `git worktree add`); do the work; commit.

**Flow:** switch to the unit's worktree+branch → do the work per the ticket's
slice scope / acceptance boundary / spec pointers → commit → spawn the
`unit-review`.
