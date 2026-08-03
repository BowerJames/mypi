---
name: unit-review
description: Wayfinder implementation — a wayfinder:unit-review atomic in-band review of a development branch vs the trunk, with a user approve/rework gate. Reads the repo; never writes.
---

# Wayfinder — `unit-review` (review one unit)

## Facts

- **Type:** `wayfinder:unit-review` — **atomic** (renamed from `code-review`).
- **Close:** **self** — at the user gate (approve *or* rework). Fire-and-forget either way.
- **Repo write:** **read** — run the repo's tests / lint / format; never write.
- **Spawns:** approve → `merge`; rework → `development` (rework round).

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:unit-review`**. It reviews **one unit's branch** against the trunk, then hands pass/fail to the user. Every `*-map` composite that owns code gets a `*-review` child; `unit-review` mirrors `implementation-map`→`implementation-review`.

## Review mechanism — in-band, active-session model

- **In-band doctrine injection.** `/wayfinder <unit-review>` turns the current agent into the reviewer for one turn. **No subprocess is spawned** and the standalone `code-review` / `code-review-prompt` bundles are **not reused** — the same clear-then-inject pattern as the rest of wayfinder.
- **Reviewer model = the active session model.** With no subprocess there is nowhere to pass `--model`; the reviewer is whatever model the session is running. Switch with `/model` beforehand and re-run on a clean slate.

## Run the review

1. **Read the requirements** from the linked `unit-map` (slice scope, acceptance boundary, spec pointers) + its `development` round's title/body/comments + the source spec.
2. **Diff the right branches**: the unit branch `dev/<spec-slug>/<n>-<slug>` vs the trunk `implement/<spec-slug>`.
3. **Run the repo's tests / lint / format** on the relevant tree (you **read** the repo; you do not write it).
4. **Post the findings + a non-binding recommendation** as a comment on this review ticket — structured, with the diff summary, check results, and an approve/rework suggestion.

## Pass/fail is a user gate

The reviewer **never self-adjudicates**. After posting findings, stop and ask the user **one question — approve or rework**:

- **Approve** → spawn a `merge` (linked to the `unit-map`), then **self-close**.
- **Rework** → spawn a `development` rework round on the same branch (linked to the `unit-map`), then **self-close**.

Either way `unit-review` self-closes at the gate; the outcome is the user's call, never the agent's.

## Eligibility — a runnability gate, not a creation gate

A `unit-review` can be created anytime; it carries a soft `Blocked by: commits on dev/<spec-slug>/<n>-<slug>` body line. Run the review once the branch has ≥1 commit beyond the recorded trunk, then clear the line.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**. Read `development` (what was built) and `merge` (what approve triggers) for foresight.
