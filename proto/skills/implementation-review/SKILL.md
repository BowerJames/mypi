---
name: implementation-review
description: Use this skill when working the wayfinder `implementation-review` ticket — review the integrated trunk against the full spec; approve→close the map, rework→spawn a successor (one-per-run). Self closes only on approve.
---

# `implementation-review` — review the integrated trunk (atomic)

**Role.** Reviews the integrated trunk vs the **full spec**. (Renamed from
`full-review` in #108.) The `*-review` child of `implementation-map`. Created at
kickoff carrying a soft, recomputed `Blocked by: open children`. **One per run**
(#107): on rework it **spawns a successor** `implementation-review` and stays
open through the rework rounds.

**Atomic/composite:** atomic. **Closes on approve** (closes itself + the
`implementation-map`); on rework it spawns a fresh successor and **stays open**.

**Repo-write:** reads the repo (runs checks on the integrated trunk); does not
write it.

**Flow:** verify no other impl ticket is open → review the trunk
`implement/<spec-slug>` vs the **base branch recorded in the
`implementation-map`** and the full spec → run the repo's checks → post findings
+ non-binding recommendation → **user gate**: approve → close the
`implementation-map` + self, **leave the trunk→base merge to the user** (Full
Review approves, it does not land); rework → spin off fresh `unit-map` children
(recorded on the map) and spawn a successor `implementation-review`.
