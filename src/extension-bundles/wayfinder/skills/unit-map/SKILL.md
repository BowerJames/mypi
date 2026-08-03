---
name: unit-map
description: Wayfinder implementation — a wayfinder:unit-map composite. Owns one shared branch for a mergeable unit; closes when its merge lands. Drives development → unit-review → merge.
---

# Wayfinder — `unit-map` (one mergeable unit)

## Facts

- **Type:** `wayfinder:unit-map` — **composite**.
- **Close:** all children closed **and** `merge` landed (dynamic re-scan).
- **Repo write:** records the planned unit branch; materialised lazily by its `development` round (the composite itself writes no code).
- **Spawns:** `development` (round 1) at creation; the coding→review→land loop follows.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:unit-map`**. It is the **unit composite** under the `implementation-map`: the index for **one mergeable unit**, owning one shared branch. Driving it means driving its frontier child (`development` / `unit-review` / `merge`).

## Role — owns one shared branch

`unit-map` owns **one shared branch** `dev/<spec-slug>/<n>-<slug>` plus a worktree, materialised **lazily** on first work-start. Rework rounds **reuse the same branch** — round-1-vs-rework is *position in the unit*, not a separate primitive (this is why there is no `follow-up-development`). The unit metadata (slice scope, acceptance boundary, spec pointers, planned branch + worktree) rides on the `unit-map`, not on any single round.

## The unit lifecycle

A unit flows `development` → `unit-review` → `merge`, looping on rework:

1. **`development`** (atomic): switch to the unit's worktree+branch, do the round's work, commit. On completion it **self-closes** (fire-and-forget) and spawns a `unit-review`. The first `development` round materialises the branch + worktree.
2. **`unit-review`** (atomic): in-band review of the branch vs the trunk, then a **user gate**. Approve → spawns `merge`; rework → spawns another `development` round (same branch). It **self-closes** at the gate either way.
3. **`merge`** (atomic): lands the unit branch on the trunk (`--no-ff`), cleans up the worktree + branch, **self-closes**.
4. **`unit-map` closes** when all its children are closed **and** `merge` has landed.

Rework never opens a new branch or a new primitive — it is just the next `development` round on the same branch, reviewed by the next `unit-review`.

## Frontier & children

- **Children (dynamic):** the `development` round(s), `unit-review`(s), and `merge` for this unit. Wire concrete ordering as `Blocked by:` only where one can't start until a specific other closes (e.g. `merge` after an approved `unit-review`, which holds by construction).
- **Frontier:** the unit's open, unblocked, unclaimed child; first in order wins.
- **Eligibility is soft-doctrine.** "merge after approved unit-review" holds by construction (a `merge` is only ever spawned by a passing `unit-review`'s gate) — no native `blocked_by` is wired inside the lifecycle.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**. Read `development` (a coding round), `unit-review` (the gate), and `merge` (landing) for their phase how-to.
