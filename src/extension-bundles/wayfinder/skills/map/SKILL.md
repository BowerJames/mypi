---
name: map
description: Wayfinder planning — the umbrella wayfinder:map composite. Chart the destination breadth-first, create the map and its first planning tickets, then graduate fog. Loads on /wayfinder (no ref) or an open wayfinder:map.
---

# Wayfinder — `map` (chart the umbrella)

## Facts

- **Type:** `wayfinder:map` — **composite**.
- **Close:** the **Destination** is reached **and** every in-scope child is closed. "Children" is a **dynamic set re-scanned at close-time** (rework / research tickets appear mid-effort), not a fixed roster — so "all children closed" is a runtime scan, never static `blocked_by` IDs.
- **Repo write:** never — planning is tracker-only.

## When this loads

This skill loads when the overview dispatches a **no-arg** `/wayfinder` (chart) or an **open `wayfinder:map`** (continue charting / drive the phase composites). It is the **umbrella** that scopes the whole lifecycle: plan → spec → implement.

## Chart flow

You are charting a **wayfinder map** for an effort too big for one session and wrapped in fog. You **plan, you don't do**: this turn creates the map and its first tickets, then stops — it resolves nothing. Produce decisions, not deliverables.

1. **Grill the destination.** The destination is what reaching the end of this map looks like (a spec to hand off, a decision to lock, or a change made in place). Name it first — it fixes the scope every ticket is measured against.
2. **Map the frontier, breadth-first.** Fan out across the whole space rather than going deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog**, the journey is small enough to skip the map — stop and tell the user how they'd like to proceed.
3. **Create the map** (the `wayfinder:map` parent) with Destination and Notes filled in, *Decisions so far* empty, and the fog sketched into *Not yet specified*.
4. **Create the primitive tickets you can specify now** as children of the map — then **wire blocking in a second pass** (issues need ids before they can reference each other). Everything you can't yet specify stays in *Not yet specified*; don't pre-slice the fog into ticket-sized pieces.
5. **Stop.** Charting is one turn's work.

## Structure — `plan-map` is optional

The umbrella `map` may hold planning atomics (`decision` / `prototype` / `research` / `task`) **directly** for a lightweight (planning-only) effort, skipping the `plan-map` layer. **Omitting `plan-map` is a human-confirm gate** — propose it and wait for a yes; never silently drop the layer. If the effort later gains an implementation phase, graduate a `plan-map` and re-parent its atomics under it.

## Bridge to implementation

When the route requires implementation, the umbrella creates a `wayfinder:spec` child (the plan→implement bridge). A **closed** `spec` then dispatches to implementation kickoff — see the `spec` and `implementation-map` skills.

## Grilling (used to pin the destination)

To pin down a destination or resolve a Decision, grill the user **relentlessly**:

- Ask **one** question, then wait for the answer before continuing. Multiple questions at once are bewildering.
- Walk down each branch of the decision tree, resolving dependencies one by one.
- For each question, give your **recommended answer** so the user can accept it in a word.
- If a *fact* can be found by exploring the environment (filesystem, `gh` / `glab`, docs), look it up rather than asking. The *decisions* are the user's — put each one to them and wait.
- For the chart flow, go **breadth-first**: fan out across the whole space rather than deep on any one thread.
- Don't act until you've reached a shared understanding.

> The shared meta-doctrine (plan-don't-do · fog of war · refer-by-name · grilling) and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `map` phase how-to.
