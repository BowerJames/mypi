---
name: decision
description: Use this skill when working a wayfinder `decision` ticket — resolve one decision by grilling the user one question at a time (with a recommended answer each), never answering for the human.
---

# `decision` — resolve one decision (atomic)

**Role.** Resolve a single decision. Worked by **grilling**: one question at a
time, each with a **recommended answer**; you never answer for the human.

**Atomic/composite:** atomic. **Closes when** the decision is made (resolution
posted as `## Answer`).

**Repo-write:** reads the tracker only.

**Flow:** read it → find its parent map → re-orient to the destination →
**claim** → grill to a shared understanding → post `## Answer`, close, append a
one-line pointer to the map's *Decisions so far* → graduate any newly-
specifiable fog. If it sits past the destination, rule it **out of scope**
instead.
