---
name: unit-review
description: Use this skill when working a wayfinder `unit-review` ticket — in-band review of a development branch against the unit's requirements; approve→merge, rework→development. Self-closes at its gate.
---

# `unit-review` — review a development branch (atomic)

**Role.** Reviews a `development` branch against the unit's requirements.
(Renamed from `code-review` in #108.) The `*-review` child of `unit-map`.

**Atomic/composite:** atomic. **Closes at its gate** — self-closes whether the
user approves *or* sends rework (it does not wait).

**Repo-write:** reads the repo (runs tests/lint/format on the dev tree); does
not write it.

**Flow:** read inputs (the linked `development` ticket's title/body/comments for
requirements) → diff `<dev-branch>` vs the trunk `implement/<spec-slug>` → run
the repo's checks → post structured findings + a **non-binding** recommendation
→ **user gate**: approve → spawn `merge`; rework → spawn another `development`
round (same primitive, same branch). The reviewer is the active session model
(in-band; switch with `/model` and re-run).
