---
name: task
description: Wayfinder planning — a wayfinder:task atomic. Manual prerequisites that block a decision; drive them yourself or hand off a precise checklist.
---

# Wayfinder — `task` (manual prerequisites)

## Facts

- **Type:** `wayfinder:task` — **atomic**.
- **Close:** when the manual work is done (self-contained; `Blocked by:` gates work-start, not close).
- **Repo write:** never — manual prerequisites are tracker-only.
- **Spawns:** fire-and-forget.

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:task`**. A Task is manual work that must happen **before** a decision can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done.

## Workflow

1. **Read** the ticket and its parent map; re-orient to the destination and to **which decision this unblocks**.
2. **Claim** it before any work.
3. **Drive it yourself where you can** (provision access, move data, sign up for a service so its API can be judged). Otherwise **hand the user a precise checklist** — concrete steps, not a vague "set up X".
4. **Resolve**: append an `## Answer` heading recording what was done **and any resulting facts** (credentials location, new URLs, row counts), set the ticket resolved, then append a one-line pointer to the map's *Decisions so far*. Graduate any newly-specifiable fog.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `task` phase how-to.
