---
name: decision
description: Wayfinder planning — a wayfinder:decision atomic. Resolve a decision by grilling one question at a time with a recommended answer; never answer for the human.
---

# Wayfinder — `decision` (resolve by grilling)

## Facts

- **Type:** `wayfinder:decision` — **atomic**.
- **Close:** when the decision is made (self-contained; `Blocked by:` gates work-start, not close).
- **Repo write:** never — planning is tracker-only.
- **Spawns:** fire-and-forget (graduates new specifiable fog into fresh tickets; never waits on what it spawns).

## When this loads

This skill loads when the overview dispatches an **open `wayfinder:decision`**. Read the ticket, re-orient to its parent map's destination, claim it, then grill.

## Grilling — one question at a time

To resolve a Decision, grill the user **relentlessly**:

- Ask **one** question, then wait for the answer before continuing. Multiple questions at once are bewildering.
- Walk down each branch of the decision tree, resolving dependencies one by one.
- For each question, give your **recommended answer** so the user can accept it in a word.
- If a *fact* can be found by exploring the environment (filesystem, `gh` / `glab`, docs), look it up rather than asking. The *decisions* are the user's — put each one to them and wait.
- Don't act until you've reached a shared understanding.

## Resolve & graduate

1. **Read** the ticket and find its parent map (`Part of #<map>` or the sub-issue link); re-orient to the destination.
2. **Claim** it (assign to yourself / set `Status: claimed`) before any work, so concurrent sessions skip it.
3. **Grill** to the decision (above). You never answer for the human.
4. **Resolve**: post the answer as a resolution (a comment / an `## Answer` heading), close the ticket, and append a one-line pointer (gist + link) to the map's *Decisions so far*.
5. **Graduate the fog**: if the resolution makes new tickets specifiable, create them (create-then-wire) and clear each graduated patch from *Not yet specified*. If it reveals a ticket sits beyond the destination, rule it **out of scope** (close it, leave one line in *Out of scope*) rather than resolving it on the route.

> The shared meta-doctrine (plan-don't-do · fog of war · refer-by-name) and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `decision` phase how-to.
