---
name: research
description: Use this skill when working a wayfinder `research` ticket — grill for external/credentialled starting sources, record them, then investigate against primary sources and post findings.
---

# `research` — sources-then-investigate (atomic)

**Role.** Investigate a question against **primary sources** and capture the
findings. Worked in a fixed order: **sources before investigation**.

**Atomic/composite:** atomic. **Closes when** the fog is pushed back enough that
the correct new primitives can be created.

**Repo-write:** reads sources (repo-internal ones directly).

**Flow:** (1) check for an existing `## Sources` — if present, skip to
investigate; (2) grill for **external/credentialled** entry points one at a
time (docs URLs, external repo paths, API endpoints + credentials, version
bounds) — read repo-internal sources directly, never grill; (3) record
`## Sources` **before** investigating; (4) **hard gate** — refuse to investigate
on an empty source set (route through Blocked/Task/*Not yet specified*); (5)
investigate against the recorded sources; (6) post `## Answer`, close, graduate.
