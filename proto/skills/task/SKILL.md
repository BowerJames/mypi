---
name: task
description: Use this skill when working a wayfinder `task` ticket — do the manual prerequisite work (provision access, sign up, move data) that blocks a decision, then record the resulting facts.
---

# `task` — manual prerequisite work (atomic)

**Role.** Manual work that must happen **before** a decision can be made
(provision access, sign up for a service so its API can be judged, move data so
its shape can be seen). Nothing to decide, prototype, or research — but the
discussion is blocked until it's done.

**Atomic/composite:** atomic. **Closes when** the work is done; the resolution
records what was done and any resulting facts (credentials location, new URLs,
row counts).

**Repo-write:** as needed by the task.

**Flow:** read it → claim → **drive it yourself where you can**; otherwise hand
the user a precise checklist → record the outcome as `## Answer` → close →
graduate.
