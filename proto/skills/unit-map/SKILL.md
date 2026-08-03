---
name: unit-map
description: Use this skill when working the wayfinder `unit-map` — the composite for one mergeable unit (one shared branch) that drives development/unit-review/merge children and closes when the merge lands.
---

# `unit-map` — one mergeable unit (composite)

**Role.** The composite unit owning **one shared branch**. (Renamed from
`develop-map` in #107.) Owns `development` + `unit-review` + `merge` children.
Has a review (`unit-review`, its `*-review` child per the derivable rule).

**Atomic/composite:** **composite**. **Closes when** `merge` lands **and** all
its children are closed.

**Repo-write:** n/a (its children write the repo).

**What `/wayfinder <unit-map>` does:** drive the unit — work the `development`
child, then `unit-review`, then `merge`. Rework is **another `development`
round on the same branch** (no separate `follow-up-development` primitive —
deleted in #107).
