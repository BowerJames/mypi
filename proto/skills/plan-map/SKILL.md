---
name: plan-map
description: Use this skill when working the wayfinder `plan-map` — the planning-phase composite that drives decision/prototype/research/task children until the route is clear to spec.
---

# `plan-map` — planning phase (composite)

**Role.** The planning-phase composite under `map`. Owns the
`decision`/`prototype`/`research`/`task` atomics. Has **no review** — planning
resolves by grilling, not review (derivable rule).

**Atomic/composite:** **composite**. **Closes when** the route is clear to spec
— all its children closed and nothing left to decide before a spec can be cut.

**Repo-write:** reads the tracker only.

**What `/wayfinder <plan-map>` does:** drive the frontier — pick the unblocked,
unclaimed child (first in map order), and work it through its own skill. When
the route is clear, hand back to the `map` to spawn a `spec`.
