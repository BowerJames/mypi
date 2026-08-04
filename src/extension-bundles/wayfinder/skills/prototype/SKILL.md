---
name: prototype
description: Wayfinder planning — a wayfinder:prototype atomic. Raise fidelity with a cheap, reactable artifact built in a scratch worktree; close when the design is confirmed or new primitives spin off.
---

# Wayfinder — `prototype` (raise the fidelity)

## Facts

- **Type:** `wayfinder:prototype` — **atomic**.
- **Close:** when the user confirms a design, **or** new primitives are spun off to push the fog back further (self-contained; `Blocked by:` gates work-start, not close).
- **Repo write:** writes a **scratch worktree** under `~/.worktrees/<map-slug>/<ticket-slug>/` — never the main repo's tracked files.
- **Spawns:** fire-and-forget.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:prototype`**. Read the ticket, claim it, then raise the fidelity of the discussion.

## Workflow

A Prototype raises the fidelity of the discussion with a **cheap, rough artifact the user can react to** — an outline, a stub, UI/logic code. It is not the production build; it exists to make a decision reactable.

1. **Read** the ticket and its parent map; re-orient to the destination.
2. **Claim** it before any work.
3. **Scaffold a worktree** at `~/.worktrees/<map-slug>/<ticket-slug>/` and build there (an isolated checkout, so it never contends with the main tree).
4. **Raise fidelity** to the cheapest level that makes the open question reactable. Stop as soon as the user can react.
5. **Resolve**:
   - If the user **confirms a design**, post the confirmed design as the resolution (an `## Answer`), close the ticket, append a one-line pointer to the map's *Decisions so far*, and graduate any newly-specifiable fog.
   - If the artifact **reveals new fog** (more decisions now specifiable), spin those off as new primitives, record what the prototype proved as a digest on the ticket, close it, and graduate.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `prototype` phase how-to. Where a prototype encodes a decision precisely (a state machine, a schema, a type shape), the downstream `spec` skill ingests a trimmed digest of it — not the whole working demo.
