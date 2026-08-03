---
name: map
description: Use this skill when working the wayfinder umbrella `map` — the top-level composite spanning the whole lifecycle (chart the destination, manage phase-composite children, declare the destination reached).
---

# `map` — the umbrella (composite)

**Role.** The top-level parent spanning the whole lifecycle. The **index**:
Destination · Notes · Decisions so far · Not yet specified · Out of scope. It
gists and links; each decision lives in exactly one place — its ticket.

**Atomic/composite:** **composite**. **Closes when** the Destination is reached
**and** every in-scope child is closed.

**Repo-write:** reads the tracker only.

**What `/wayfinder <map>` (or bare `/wayfinder`) does here:**
- If the destination/children are incomplete → **chart**: grill the destination
  breadth-first, create the `map` + the frontier children you can specify now,
  wire blocking in a second pass, sketch the rest into *Not yet specified*.
- Else → **drive phase composites**: manage the `plan-map` (and, once a spec
  exists, the `implementation-map`) toward the destination.

*(Full chart/grilling doctrine migrates here from today's `buildChartDoctrine`
in `prompt.ts`; the compact shared frame lives in the overview, not here.)*
