---
name: research
description: Wayfinder planning — a wayfinder:research atomic. Grill for starting sources, record them, then investigate against them and post findings. Never writes the repo.
---

# Wayfinder — `research` (sources before investigation)

## Facts

- **Type:** `wayfinder:research` — **atomic**.
- **Close:** when the fog is pushed back enough that the correct new primitives can be created (self-contained; `Blocked by:` gates work-start, not close).
- **Repo write:** never — investigation is tracker-only.
- **Spawns:** fire-and-forget.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:research`**. A research session is **user-spawned and pointed at the ticket** (never auto-launched) — like any other ticket, one at a time.

## Research workflow — sources before investigation

A Research ticket is worked in a fixed order — **sources before investigation**:

1. **Check for an existing `## Sources`.** Read the ticket body (and its comments). If a `## Sources` heading already exists, the sourcing has been done — **confirm once** that it is still the intended set, then skip to step 5. A re-run never re-grills.
2. **Grill for external/credentialled entry points, one at a time.** Ask the user **one** question at a time, each with a **recommended answer**, for the entry points you can't reach yourself: documentation URLs; external repo/file paths; API endpoints (with any credentials, or where to find them); version/date bounds. These are **sources only** — the research *question* stays as written; ask no sub-questions, and pin no output shape. Repo-internal sources (your own code, specs, configs) you read **directly** — never grill for them.
3. **Record `## Sources`.** Write the agreed sources to the ticket as a `## Sources` section (paralleling the `## Answer` resolution heading), **before** any investigation — so the agent commits to a source set rather than drifting mid-investigation. On a hosted tracker every comment is read, so `## Sources` flows downstream with no extra wiring.
4. **Hard gate — refuse to investigate on an empty source set.** If no external/credentialled source is supplied, **do not investigate**. Instead record the ticket **blocked** and push it forward through the existing seams — suggest a **Task** (gather candidate resources), or move the question to the map's *Not yet specified*. No new state: reuse the existing Blocked / Task / *Not yet specified* machinery.
5. **Investigate against the recorded sources.** Now research the question against the recorded `## Sources`, reading each one and capturing the findings.
6. **Resolve and graduate as normal.** Post the findings as an `## Answer` (the resolution heading), close the ticket, and append a one-line pointer to the map's *Decisions so far*. Graduate any newly-specifiable fog into fresh tickets; clear each graduated patch from *Not yet specified*.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `research` phase how-to.
