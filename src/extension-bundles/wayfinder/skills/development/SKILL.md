---
name: development
description: Wayfinder implementation — a wayfinder:development atomic coding round. Switch to the unit's worktree+branch, do the work, commit, then spawn a unit-review. Rework folds in as another round. Must write the repo.
---

# Wayfinder — `development` (one coding round)

## Facts

- **Type:** `wayfinder:development` — **atomic**.
- **Close:** when the round's work is **committed** (self-contained; fire-and-forget). Rework is **another `development` round** on the same branch — not a separate primitive (`follow-up-development` is deleted).
- **Repo write:** **must** — branches / commits. The whole point of the round is code on disk.
- **Spawns:** `unit-review` on completion (fire-and-forget — never waits on it).

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:development`**. It is **one coding round** on the unit's shared branch. `development` was reclassified composite→atomic: it is a single self-closing round, not an index — the unit-anchor role moved to the `unit-map` composite.

## Complete a round

1. **Read** the ticket + its parent `unit-map` (slice scope, acceptance boundary, spec pointers) and the source spec for *how/why*.
2. **Materialise the unit branch + worktree** if not yet present (lazy): `git branch dev/<spec-slug>/<n>-<slug> <trunk>` then `git worktree add ~/.worktrees/<spec-slug>/<n>-<slug> dev/<spec-slug>/<n>-<slug>`. The first round materialises; rework rounds reuse them.
3. **Switch to the worktree + branch** and **do the work** — the slice scope owned by this unit, honouring the spec's Implementation Decisions.
4. **Commit** on the unit branch. Refer to the ticket by its **title** in the commit message.
5. **Spawn a `unit-review`** (linked to this `unit-map`; it reads the requirements from the `unit-map` + spec). Carry a soft `Blocked by: commits on dev/<spec-slug>/<n>-<slug>` line, cleared once the branch has ≥1 commit beyond the trunk.
6. **Self-close.** The round is done once committed and the review is spawned — `development` is fire-and-forget; it does **not** wait for the review, and it does **not** stay open until merge. The unit's landing is tracked by the `unit-map` composite, not by holding this round open.

## Rework folds in

A `unit-review` that returns **rework** spawns the next `development` round on the **same branch** (no new branch, no new primitive). Round-1-vs-rework is just position in the unit. Pick up the review findings, commit the rework, spawn the next `unit-review`, self-close — same loop.

## Acceptance

"Done for this round" = the slice scope is implemented and committed, the commit message references the ticket **title**, and a `unit-review` is linked and unblocked. The round's *quality* is judged by `unit-review`; this skill only ships the work.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**. Read `unit-review` (what "done" is judged against) and `merge` (how the unit lands) for foresight.
