---
name: spec
description: Use this skill when working a wayfinder `spec` ticket — synthesise (or re-synthesise/overwrite) the PRD-style spec from a closed plan-map's durable inputs. Never writes the repo.
---

# `spec` — synthesise the PRD (atomic bridge)

**Role.** The **atomic bridge** between planning and implementation. A
first-class child of `map`, created when the route needs implementation and
triggered via `/wayfinder <spec>`. **Never writes the repo** (the repo-write
inversion lives here, #104).

**Atomic/composite:** atomic. **Closes when** the spec issue is published (first
run) / overwritten in place (re-run).

**Repo-write:** **never** writes the repo — the spec lives only as the issue
body. No `docs/specs/` mirror, ever.

**Flow:** gate on eligibility (the `plan-map` + children closed) → gather durable
inputs (map body + every closed child's resolution + targeted codebase
exploration; ignore the live conversation) → ingest prototype/research as a
digest → fill the verbatim 7-section template → publish in one shot (no confirm
gate; re-run overwrites in place). *(Full doctrine migrates from today's
`buildSpecDoctrine` in `prompt.ts`.)*
