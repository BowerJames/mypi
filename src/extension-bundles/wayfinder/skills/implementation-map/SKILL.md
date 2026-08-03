---
name: implementation-map
description: Wayfinder implementation — the wayfinder:implementation-map composite (index and trunk). Created by kickoff; not a work target. Closes when all children close and implementation-review passes.
---

# Wayfinder — `implementation-map` (index + trunk)

## Facts

- **Type:** `wayfinder:implementation-map` — **composite**.
- **Close:** all children closed **and** `implementation-review` passed. Children are a **dynamic set re-scanned at close-time**.
- **Repo write:** records the trunk `implement/<spec-slug>` + `Base branch:` (writes no code itself — it is **not a work target**).
- **`Blocked by: spec`** (concrete, wired) gates creation.

## When this loads — redirect, don't work

The `implementation-map` is an **index**, not a work target. `/wayfinder <implementation-map>` **redirects** to the frontier `unit-map` / `development` ticket — it never runs work directly. (Mirror of the planning `map` redirecting to its frontier atomic.) This skill loads only to explain the kickoff + the namespace; day-to-day, point at a child.

## Kickoff (`/wayfinder <closed-spec>`)

Turns a **closed** `wayfinder:spec` into a sliced implementation effort.

1. **Eligibility gate — refuse-and-name.** The ref must be a **closed** `wayfinder:spec`. On failure, refuse and name the exact problem: open spec → "close it first"; not a spec → "run the spec synthesis first"; unresolvable ref → usage error. No `--force`.
2. **Propose-then-create.** Read the full spec + do targeted codebase exploration, lay out the proposed **slice** (the `unit-map` units) + an **ordering**, and **wait for a yes/no**. **Nothing is created until confirmed** — no ticket, branch, or worktree. Re-slicing is cheap while still a proposal; noisy once tickets/branches/worktrees exist.
3. **Coarse-by-default slicing**, cut along seams/modules honouring the spec's Implementation Decisions. **Split only on genuine file/seam independence** — the test is whether two units touch the same files or would create merge-conflict storms landing on the trunk; if yes, they are not independent and stay as **one** unit. By construction the units are independently mergeable, so **no inter-unit blocking dependencies are wired** — ordering is a suggestion, not a block.
4. **Lazy materialisation.** Record each unit's planned branch + worktree *paths* on its `unit-map`; cut only the **trunk** at kickoff.
5. **`unit-map` body** — self-contained on *what/where*, points at the spec for *how/why*: `Part of #<implementation-map>` + link to the source spec; **slice scope** (seam/module owned + files expected to touch); **acceptance boundary** (a testable "done for this unit"); **spec pointers** (references, not copies); **branch + worktree paths** (planned).
6. **Kickoff sequence** (post-confirmation): capture the current branch (`git branch --show-current`) → cut `implement/<spec-slug>` from it → create the **implementation-map** (records `Root branch: implement/<spec-slug>` and `Base branch: <captured>`) → create each **`unit-map`** child (+ its first `development` round) → wire each as a child (`Part of #<map>` + task-list) → create the **`implementation-review`** child carrying `Blocked by: all other implementation tickets closed`. Decomposition is then done; the user drives units one at a time.

## Branching & namespace

- **Per-effort integration trunk** `implement/<spec-slug>`, **cut from the current branch at kickoff** (whatever `HEAD` is on — captured via `git branch --show-current`, recorded as `Base branch:`, **not** hardcoded to `develop`/`main`). All units of one effort integrate against this one stable branch.
- **One namespace, keyed on the spec slug** (the stable, human-named kickoff anchor): trunk `implement/<spec-slug>`; unit branch `dev/<spec-slug>/<n>-<slug>`; unit worktree `~/.worktrees/<spec-slug>/<n>-<slug>`. `<n>` is the tracker ticket number, **raw (no zero-padding)**. `git branch | grep <spec-slug>` finds the trunk and every unit at once.
- **Units are worktrees-on-branches.** Each unit is a branch plus a dedicated worktree (a checkout of that branch) so multiple units run in parallel without contending for one working tree.
- **Lazy materialisation.** The trunk is cut at kickoff; each unit **branch + worktree is materialised only when `/wayfinder <development>` starts work on that unit** — `git branch <dev-branch> <base>` then `git worktree add <worktree-path> <dev-branch>`. Do not create N working trees for units not yet in flight.
- **Final trunk→base merge is the user's.** `implementation-review` is the **approval** gate, not the landing step — record on it that the trunk is approved and ready to land, and leave the merge into the base branch to the user. Wayfinder plans; it never answers for the human.

## Two stores: ephemeral tickets, real repo

Tickets live on the tracker (github/gitlab) or under ephemeral `/tmp/.wayfinder/<repo>/<effort>/` scratch (local); git branches/merges happen on the **real cwd repo**, which is persistent regardless of tracker. None of the primitives are tracker-gated: `development` is a branch in cwd; `merge` is `git merge` in cwd (works without a remote — you just can't `push`); reviews run in-band (tracker-agnostic). On local, the durable record of a finished effort is the **merged branch in cwd** — its commits (referencing ticket **titles**) are the record.

**Repo-write inversion.** The repo-write policy lives in the skills: `spec` → **never** writes the repo; `development` / `merge` → **must** write the repo (branches/merges); the review skills **read** the repo (run checks) but do not write it. This is per-phase, not per-command.

> The shared meta-doctrine (refer-by-name etc.) and the tracker-ops section ride in the **always-injected overview**. Read `unit-map` (one unit's lifecycle), `development` / `unit-review` / `merge` (the coding→review→land loop), and `implementation-review` (the terminal review) for their phase how-to.
