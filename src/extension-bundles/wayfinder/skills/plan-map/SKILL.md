---
name: plan-map
description: Wayfinder planning — the wayfinder:plan-map planning-phase composite. Holds decision/prototype/research/task atomics; closes when its children close and the route is clear to spec.
---

# Wayfinder — `plan-map` (planning-phase composite)

## Facts

- **Type:** `wayfinder:plan-map` — **composite**.
- **Close:** all children closed **and** the route is clear to **spec** (the planning questions are resolved enough to hand off).
- **Repo write:** never — planning is tracker-only.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:plan-map`**. It is the **planning-phase composite** under the umbrella `map`: the index you *manage* (drive its atomics toward a clear route), never work directly. Pointing `/wayfinder` here drives the frontier planning atomic (a `decision` / `prototype` / `research` / `task` child).

## Role

`plan-map` groups the planning atomics for one effort and adds the single extra close criterion beyond all-children-closed: **the route is clear to spec**. It exists to scope the planning phase distinctly from implementation.

## Optional layer (confirm gate)

`plan-map` is **optional**. A lightweight (planning-only) effort holds its atomics **directly** under the umbrella `map`, skipping this layer. The agent **proposes** omitting `plan-map` and **confirms with the user** before structuring the effort that way — the layer is never silently dropped. If the effort later gains an implementation phase, graduate a `plan-map` and re-parent its atomics under it.

## Children & frontier

- **Children:** `decision`, `prototype`, `research`, `task` (the planning atomics). Wire concrete issue-to-issue ordering as `Blocked by:`; the all-children-closed close-check is a runtime re-scan.
- **Frontier:** the map's open, unblocked, unclaimed children; first in map order wins.
- **Graduation:** resolving a child clears the fog ahead of it, **graduating** what's now specifiable into fresh tickets; clear each graduated patch from *Not yet specified*.
- **No review child:** `map` and `plan-map` have no `*-review` child — planning resolves by grilling (the human *is* the review).

> The shared meta-doctrine (plan-don't-do · fog of war · refer-by-name · grilling) and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `plan-map` phase how-to. Read the `decision` / `prototype` / `research` / `task` skills for each atomic's workflow.
