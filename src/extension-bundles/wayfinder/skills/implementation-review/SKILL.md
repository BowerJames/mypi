---
name: implementation-review
description: Wayfinder implementation — a wayfinder:implementation-review atomic terminal review of the integrated trunk vs the full spec, with a user gate. One-per-run; on rework spawns a successor. Reads the repo.
---

# Wayfinder — `implementation-review` (review the whole effort)

## Facts

- **Type:** `wayfinder:implementation-review` — **atomic** (renamed from `full-review`).
- **Close:** **self** — at the user gate. On **approve**, record the trunk approved + ready to land and **self-close only** (no skill closes another ticket: the `implementation-map` *becomes unblocked* once all its children are closed — this review included — and is picked up & closed via its own close-check). On **rework**, spawn a **successor** `implementation-review` (and stay closed itself) — one review per run, only the last passes.
- **Repo write:** **read** — review the integrated trunk vs the full spec; never write.
- **Spawns:** rework → successor `implementation-review` (its `Blocked by:` lists the fresh rework `unit-map`s) + fresh `unit-map` children.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:implementation-review`**. It is the **terminal review** of the integrated trunk against the full spec — the approval gate that clears the effort for landing (`implementation-review` self-closes; the `implementation-map` then becomes unblocked once all its children are closed and is picked up & closed via its own close-check). `implementation-review` supersedes the old "full-review stays open through rework" doctrine: it is **atomic fire-and-forget**, so on rework it spawns a successor and self-closes (one review per run, only the last passes).

## Eligibility — a runtime check (dynamic child set)

`implementation-review` is created at kickoff but is **kept off the frontier** until **every other** `implementation-map` child is closed. The child set is dynamic (`unit-map`s, rework `development` rounds, etc. appear mid-effort), so "all other children closed" is a **runtime re-scan** the overview recomputes before dispatching — **never** a `Blocked by:` body line and never static `blocked_by` IDs. Concept gates are workflow doctrine applied at runtime; `Blocked by:` is reserved for concrete issue-to-issue deps (e.g. the successor `implementation-review` ← its rework `unit-map`s, a static set known at spawn).

## Run the review

1. **Read the full closed spec** (the `wayfinder:spec` the `implementation-map` records).
2. **Diff the right branches**: the trunk `implement/<spec-slug>` vs the **base branch recorded in the `implementation-map`** body.
3. **Run the repo's tests / lint / format** on the integrated trunk (you **read** the repo; you do not write it).
4. **Post the findings + a non-binding recommendation** as a comment on this review ticket — does the integrated trunk realise the full spec? Structured findings + an approve/rework suggestion.

## Pass/fail is a user gate

The reviewer **never self-adjudicates**. After posting findings, stop and ask the user **one question — approve or rework**:

- **Approve** → **self-close only**. Record on this ticket that the trunk is **approved and ready to land**, and **leave the trunk→base (`implement/<spec-slug>` → base) merge to the user** — wayfinder approves; it does not land. The `implementation-map` *becomes unblocked* once all its children are closed (this review included) and is picked up & closed via its own close-check.
- **Rework** → spin off fresh `unit-map` children for the rework (recorded on the `implementation-map`), **spawn a successor `implementation-review`** (its `Blocked by:` lists those fresh rework `unit-map`s), then **self-close**. The successor is the next run's review; this one is done.

Either way `implementation-review` self-closes at the gate — atomic fire-and-forget.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**. Read `implementation-map` (kickoff + namespace) and `merge` (how units landed) for foresight.
