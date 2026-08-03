---
name: prototype
description: Use this skill when working a wayfinder `prototype` ticket — raise fidelity with a cheap, rough artifact (outline/stub/code) in a worktree the user can react to; closed on design confirmation or graduating fog.
---

# `prototype` — raise fidelity (atomic)

**Role.** Raise the fidelity of the discussion with a **cheap, rough** artifact
the user can react to (an outline, a stub, UI/logic code). Scaffold a worktree
at `~/.worktrees/<map-slug>/<ticket-slug>/` and build there.

**Atomic/composite:** atomic. **Closes when** the user **confirms a design**,
**or** new primitives are spun off to push the fog back further.

**Repo-write:** builds in a worktree (does not write the tracker-side repo).

**Flow:** read it → claim → build the artifact in the worktree → present it,
surfacing the specific reactions you need and any fog it raises → **wait** for
the user's confirmation or a wrinkle (you never confirm for the human). This
very ticket is the worked example.
