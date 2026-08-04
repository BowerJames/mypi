---
name: spec
description: Wayfinder bridge — a wayfinder:spec atomic. Open → synthesise/overwrite the PRD hand-off; closed → hand to implementation kickoff. Branches on state; never writes the repo.
---

# Wayfinder — `spec` (the plan→implement bridge)

## Facts

- **Type:** `wayfinder:spec` — **atomic**.
- **Close:** when the PRD is published (self-contained; re-run overwrites in place). `Blocked by: plan-map` (concrete, wired) gates work-start, not close.
- **Repo write:** **never** — the spec lives only as the issue body (no `docs/specs/` mirror, ever).
- **Spawns:** fire-and-forget.

## Branches on state — read the state first

This skill is the **bridge** between planning and implementation. It branches on the resolved ref's **state**:

- **Open `wayfinder:spec`** → **synthesise / overwrite** the PRD (below).
- **Closed `wayfinder:spec`** → **implementation kickoff** (below). A closed spec is a *finished hand-off*; it must **not** regress to "synthesise again".

Resolve the state, then run the matching branch.

## Open → synthesise / overwrite the PRD

You are converting a **completed** wayfinder map into a **spec issue** — a PRD-style hand-off to the build chain. You synthesise; you do **not** grill, you do **not** create wayfinder tickets, you do **not** change the repo.

1. **Gate on eligibility.** The map must be closed — map + every child resolved. If any is open, stop and name it; do not synthesise against an open map.
2. **Gather the durable inputs** — the map body (Destination · Notes · Decisions so far · Out of scope) and **every closed child ticket's resolution**. Add targeted codebase exploration. Ignore the live conversation: the stage is re-runnable from the map alone.
3. **Ingest prototype/research as a digest.** Where a closed child is a prototype or research ticket, fold a summary of what it *proved/concluded* into the relevant section — not verbatim, not a link (the spec must stay self-contained if a worktree is wiped).
4. **Fill the template** (verbatim below) from those inputs. Refer to every map and ticket by its **title** (the id rides inside the name as its link) — a wall of `#42, #43` is illegible in a hand-off doc.
5. **Publish in one shot.** Create (or, on re-run, **overwrite in place**) the `wayfinder:spec` successor issue and link it both ways. **No confirm gate** — publish immediately; recovery is downstream (re-run, or edit the published issue).
6. **Stop.** The spec is the hand-off. Its acceptance/implementation lifecycle is downstream.

### The spec template (fill this in)

```
## Problem Statement
The problem that the user is facing, from the user's perspective.

## Solution
The solution to the problem, from the user's perspective.

## User Stories
A LONG, numbered list of user stories. Each in the form:
1. As an <actor>, I want a <feature>, so that <benefit>
This list should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions
A list of implementation decisions: modules built/modified, their interfaces,
technical clarifications, architectural decisions, schema changes, API contracts,
specific interactions. Do NOT include specific file paths or code snippets — they
date fast. Exception: a prototype snippet that encodes a decision more precisely
than prose (state machine, reducer, schema, type shape) may be inlined, trimmed to
the decision-rich parts, with a note it came from a prototype.

## Testing Decisions
What makes a good test here (test external behaviour, not implementation details),
which modules will be tested, and prior art for the tests (similar tests in the
codebase).

## Out of Scope
What is out of scope for this spec.

## Further Notes
Any further notes.
```

### Seams / deep-module (process, not a section)

While filling *Implementation Decisions* and *Testing Decisions*, reason about **seams** — the boundaries where tests and change can hook in — and prefer a **deep module** (a narrow interface hiding a wide implementation):

- **Sketch the seams first.** Name where each piece joins the rest of the system (a function signature, a CLI surface, an event, a label). A good seam is narrow and stable.
- **Prefer an existing seam to a new one.** If the codebase already exposes a join point that fits, route through it rather than inventing a parallel one. State which existing seam you reused.
- **Push to the highest seam possible.** Hook as close to the edge as you can (a public command, a label, a config) before reaching into internals.
- **Ideal is one seam per concern.** If a decision implies several overlapping seams, prefer collapsing them; flag any that can't as open risk.

Record the chosen seams as part of the relevant decision ("routes through the existing X seam"), not as a separate section.

### Successor link

The spec is **produced** (not resolved) — it is **not** a child of the map (no sub-issue link). The two-way successor link is: the spec body opens with `Spec for #<map>`, and the map body carries a `Spec: #<spec>` pointer. On re-run, **overwrite the spec body in place** — same URL, stable successor link; never mint a new issue, never refuse.

## Closed → implementation kickoff

A **closed** `wayfinder:spec` is an approved hand-off. `/wayfinder <closed-spec>` triggers the **implementation kickoff**: propose a slicing of the spec into Development units, then — **on user confirm** — cut the integration trunk `implement/<spec-slug>` and create the `wayfinder:implementation-map` and its children. Hand off to the **`implementation-map` skill** for the kickoff flow. **Do not** re-synthesise a closed spec.

> The shared meta-doctrine and the tracker-ops section ride in the **always-injected overview**; this skill carries only the `spec` phase how-to. The implementation lifecycle is in the `implementation-map` / `unit-map` / `development` / `unit-review` / `merge` / `implementation-review` skills.
