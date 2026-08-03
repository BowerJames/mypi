---
name: implementation-map
description: Use this skill when working the wayfinder `implementation-map` — the implementation-phase composite (index + the per-effort integration trunk) that closes on a passing implementation-review.
---

# `implementation-map` — implementation phase (composite)

**Role.** The implementation-phase composite under `map`. The **index *and***
records the per-effort integration trunk `implement/<spec-slug>` + the base
branch. Owns `unit-map` children + a single `implementation-review`. Distinct
from the planning `map`.

**Atomic/composite:** **composite**. **Closes when** `implementation-review`
passes **and** all its children are closed.

**Repo-write:** n/a (it is an index; its children write the repo).

**`/wayfinder <implementation-map>` is a redirect** — the map is not a work
target. Point at the frontier `unit-map`/`development`, or to
`/wayfinder <spec>` to (re-)kickoff. *(Kickoff doctrine — propose a slicing, on
confirm cut the trunk + create this map + `unit-map` children + the
`implementation-review` — migrates from today's `buildImplementDoctrine`.)*
