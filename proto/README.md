# Prototype — Sketch the unified wayfinder

> Wayfinder map [#103 — *Unified wayfinder: one command, atomic/composite taxonomy, label review*](https://github.com/BowerJames/mypi/issues/103), ticket [#109 — *Prototype: Sketch the unified wayfinder (command + doctrine skeleton)*](https://github.com/BowerJames/mypi/issues/109).
>
> **This is a *prototype*, not an implementation.** Its job is to raise the
> fidelity of the design so you can react to a concrete shape — one command,
> the doctrine layout, and the atomic/composite model — and either **confirm
> the direction** or send me back with a wrinkle. Nothing here is wired into
> the real bundle; the real build is a later `/to-spec` + `/implement` on the
> resulting spec (out of scope for the map).

This artifact encodes the five closed decisions verbatim:

| Decision | What it pins down |
|---|---|
| [#104](https://github.com/BowerJames/mypi/issues/104) | One command `/wayfinder <ref>` (dispatch by label+state); `/to-spec` + `/implement` **deleted**; only a compact overview injected; phase doctrine = **one thin skill per label**, model-invocable. |
| [#105](https://github.com/BowerJames/mypi/issues/105) | No terminal-mode field — the terminal is **structural** (close conditions). One top-level `map` spans the whole lifecycle. |
| [#106](https://github.com/BowerJames/mypi/issues/106) | Atomic/composite is a **documented property of the type**, no new labels or prefix scheme. |
| [#107](https://github.com/BowerJames/mypi/issues/107) | `develop-map`→**`unit-map`** is the composite unit; **`development`** is an *atomic* work-round (rework = same primitive → `follow-up-development` **deleted**); reviews atomic; `full-review`→**`implementation-review`** is one-per-run (spawns a successor on rework). |
| [#108](https://github.com/BowerJames/mypi/issues/108) | **13 labels**, names finalised; renames (`code-review`→`unit-review`, `full-review`→`implementation-review`), new (`plan-map`, `unit-map`), reclassify (`development` composite→atomic), delete (`follow-up-development`); `spec` is a first-class atomic child of `map`. |

The skeleton has **three parts** (matching the ticket), each in its own file:

```
proto/
├── README.md                 ← you are here — the reactable overview
├── command/wayfinder.ts      ← Part A — the ONE command (dispatch skeleton)
├── overview/overview.md      ← Part B — the compact doctrine injected every time
└── skills/                   ← Part B — one thin skill per label (13)
    ├── map/SKILL.md
    ├── plan-map/SKILL.md
    ├── decision/SKILL.md
    ├── prototype/SKILL.md
    ├── research/SKILL.md
    ├── task/SKILL.md
    ├── spec/SKILL.md
    ├── implementation-map/SKILL.md
    ├── unit-map/SKILL.md
    ├── development/SKILL.md
    ├── unit-review/SKILL.md
    ├── merge/SKILL.md
    └── implementation-review/SKILL.md
```

Part C (the atomic/composite model applied to all types) lives inline in this
README as a table, and is restated inside `overview/overview.md` (it is the
taxonomy the overview always injects) and in each skill's frontmatter.

---

## Part A — The one command (`command/wayfinder.ts`)

**Before:** three commands — `/wayfinder`, `/to-spec`, `/implement` — each a
one-shot doctrine injector that builds its full doctrine string at invocation
time.

**After:** **one** command, `/wayfinder <ref>`. It does one thing in TypeScript and
hands the rest to the agent:

1. **Detect the tracker** (today's `git remote` autodetect) so the overview
   injects the correct tracker-ops section (`gh` / `glab` / local files).
2. **Clear, then inject the compact overview + a one-line resolution directive.**
   The overview is the same string every time (how to resolve a ref + dispatch
   table + meta-doctrine + taxonomy + tracker-ops — see Part B). The directive
   tells the agent to **resolve `<ref>`** as its first step (see below).

**Where resolution lives — the key shape decision.** `<ref>` may be a **number**, a
**full URL**, a **description** of the ticket, or **nothing**. Only the *agent*
can resolve all four (a description needs `gh issue list --search`, which is an
LLM judgement, not a static lookup). So the command does **not** read the issue
in TypeScript — it injects, and the agent resolves `<ref>` on its first turn:

- number → `gh issue view <n>` (reads label + state);
- URL → `gh issue view <url>` (same command; the URL carries the number);
- description → `gh issue list --search "…"`, pick the match (disambiguate with
  the user if several);
- nothing → chart.

The phase doctrine itself lives in the skill, **not** in the injection — so the
overview stays small and the model can pull in *other* phase skills for
foresight (#104). The dispatch determinism (fog #2) is preserved: label→skill
is a **fixed map** in the overview's dispatch table; the agent applies it after
resolving, rather than the command pre-naming the skill.

`/to-spec` and `/implement` are gone. Their work is absorbed: a `spec` ref
dispatches to the `spec` skill (synthesise/overwrite); an implementation ref
dispatches to `unit-map`/`development`/`unit-review`/`merge`/`implementation-review`.
`/wayfinder --help` carries the dispatch table (per the repo's "every route
needs a `--help`" rule in `AGENTS.md`).

The dispatch table (the verdict the command emits):

| `<ref>` resolves to | state | `/wayfinder <ref>` tells the agent to read skill… | and do |
|---|---|---|---|
| *(no arg)* | — | `map` | **chart**: grill the destination, create the `map` + frontier children |
| `wayfinder:map` | open | `map` | **work the map**: grill/manage phase-composite children toward the destination |
| `wayfinder:plan-map` | open | `plan-map` | drive the planning phase (manage its atomic children) |
| `wayfinder:decision` / `prototype` / `research` / `task` | open | that skill | work that planning primitive |
| `wayfinder:spec` | open **or** closed | `spec` | **synthesise** (or re-synthesise/overwrite) the spec from the closed plan-map |
| `wayfinder:implementation-map` | open | *(redirect)* | not a work target → point at the frontier `unit-map`/`development` |
| `wayfinder:unit-map` | open | `unit-map` | drive one mergeable unit (manage its children) |
| `wayfinder:development` | open | `development` | one coding round on the unit's branch (+ rework rounds) |
| `wayfinder:unit-review` | open | `unit-review` | in-band review of a development branch (approve→merge / rework→development) |
| `wayfinder:merge` | open | `merge` | land the unit on the trunk |
| `wayfinder:implementation-review` | open | `implementation-review` | review the integrated trunk vs the spec (approve→close map / rework→spawn successor) |

The repo-write inversion (#104) **dissolves into the skills**: the `spec`
skill carries "never write the repo"; the `development`/`merge` skills carry
"you must write the repo (branches/merges)". The command itself is neutral.

See `command/wayfinder.ts` for the stub.

---

## Part B — The doctrine layout (`overview/` + `skills/`)

Two layers, replacing today's three big inlined doctrine strings:

### 1. The compact overview (`overview/overview.md`) — injected every time

Carries only the **shared** frame (everything the agent needs regardless of
phase): the dispatch table, the meta-doctrine (plan-don't-do · fog of war ·
refer-by-name · grilling), and the taxonomy table (Part C). It never carries a
specific phase's how-to — that is in the skills. Keeps the injection small and
stable; the phase detail is pulled on demand.

### 2. One thin skill per label (`skills/<label>/SKILL.md`) — 13 skills

Each skill is the **phase doctrine** for one type, frontmattered so the model
can invoke it (and, per #104, read *other* phase skills for foresight — e.g.
a `development` skill glance at `unit-review` to know what "done" is judged
against). All 13 are stubbed here with: a one-line role, the close condition,
the repo-write stance, and a pointer to where the full lifecycle detail will
migrate from today's `prompt.ts`.

The 13 skills, grouped by their place in the lifecycle (the hierarchy #108/#105
fixed — a `map` contains phase composites, each contains its atomics):

```
map  (umbrella — whole lifecycle)
├── plan-map  (planning phase; route-clear-to-spec)
│   ├── decision        (atomic — grill one decision)
│   ├── prototype       (atomic — raise fidelity, worktree artifact)
│   ├── research        (atomic — sources-then-investigate)
│   └── task            (atomic — manual prerequisite work)
├── spec                (atomic bridge — synthesise the PRD; never writes repo)
└── implementation-map  (implementation phase; review-passed)
    ├── unit-map        (one mergeable unit; merge-landed)
    │   ├── development        (atomic — one coding round, incl. rework)
    │   ├── unit-review        (atomic — review a dev branch)
    │   └── merge              (atomic — land unit on trunk)
    └── implementation-review (atomic — review integrated trunk; one-per-run)
```

---

## Part C — The atomic/composite model applied to all 13 types

From #106: atomic/composite is a **documented property of the type** — no new
labels, no prefix dimension. **Derivable rules** (#108): `*-map` ⇒ composite;
`*-review` ⇒ review child of its `*-map`; `map`/`plan-map` have **no** review
(planning resolves by grilling, not review).

| Label | A/C | Parent | Closes when… | Repo-write |
|---|---|---|---|---|
| `map` | **composite** | *(top)* | Destination reached **+** all in-scope children closed | reads tracker |
| `plan-map` | **composite** | `map` | route is clear to spec (all children closed) | reads tracker |
| `decision` | atomic | `plan-map` | the decision is made (resolution posted) | reads tracker |
| `prototype` | atomic | `plan-map` | user confirms a design **or** fog graduated to new primitives | builds in worktree |
| `research` | atomic | `plan-map` | findings posted (`## Answer`); fog graduated | reads sources |
| `task` | atomic | `plan-map` | the manual work is done (facts recorded) | as needed |
| `spec` | atomic | `map` | spec issue published (first run) / overwritten (re-run) | **never** writes repo |
| `implementation-map` | **composite** | `map` | `implementation-review` passed (+ all children closed) | n/a (index) |
| `unit-map` | **composite** | `implementation-map` | `merge` landed (+ all children closed) | n/a (index) |
| `development` | atomic | `unit-map` | work committed (round 1 **and** rework are the same primitive) | **must** write repo |
| `unit-review` | atomic | `unit-map` | self-closes at its approve/rework gate | reads repo |
| `merge` | atomic | `unit-map` | unit landed on trunk (+ self + parent dev closed) | **must** write repo |
| `implementation-review` | atomic | `implementation-map` | approve → self + map closed; rework → spawns successor, **stays open** | reads repo |

**What "composite" means mechanically** (from #106/#107): a composite closes
only when its **close-time-enumerated** children are all closed **plus** its
own extra criterion (above). Child sets are dynamic (rework/dev tickets appear
mid-effort), so "all children closed" is a **runtime check**, not static
`blocked_by` IDs. `blocked_by:` is reserved for **concrete issue-to-issue
deps** (cross-phase ordering, intra-composite sibling ordering, spawned
successor); concept gates (runnability, eligibility, all-children-closed) are
**workflow doctrine**, not blocker lines.

**What the deletion/rename/reclassify nets out to (#107/#108):** 12 old labels
→ **13** labels. Net change: **−1** (`follow-up-development` deleted; rework
folds into `development`), **+2** (`plan-map`, `unit-map`), **2 renames**
(`code-review`→`unit-review`, `full-review`→`implementation-review`), **1
reclassify** (`development`: composite→atomic). Migration policy for existing
labelled issues is its own ticket — [#110](https://github.com/BowerJames/mypi/issues/110).

---

## Fog this prototype surfaces (for you to react to)

Building the skeleton concretely raised these. They are **not** in the five
closed decisions, and most need your judgement, so I'm putting them to you
rather than guessing. *(I have NOT closed this prototype — your confirmation
or a wrinkle is the close condition.)*

1. **The command must read the tracker *before* injecting.** ~~(flagged as a
   possible wrinkle)~~ **RESOLVED** (your concern): the command does **not**
   read the issue in TypeScript. `<ref>` may be a **number**, **URL**,
   **description**, or **nothing** — only the agent can resolve all four (a
   description needs `gh issue list --search`, an LLM judgement). So resolution
   is the **agent's** first turn, not the command's; the command only detects
   the *tracker* (so the overview's tracker-ops section is correct) and
   injects. Number/URL/description/nothing all work uniformly. *(Folded into
   Part A + overview.md; no new ticket.)*

2. **Deterministic vs probabilistic skill selection.** **RESOLVED by #1:** the
   command injects (it doesn't pre-name a skill), and the dispatch table in the
   overview is a **fixed map** (label→skill) the agent applies deterministically
   *after* resolving the label. The overview separately invites reading other
   phase skills for foresight (#104). So: deterministic primary skill (the
   table) + optional foresight reads — both, at no cost.

3. **Is the full overview too noisy to inject *every* time?** A 4th-round
   `development` rework still gets the whole taxonomy + dispatch table + four
   meta-doctrine sections. **Recommended:** keep it — it's the agent's *only*
   frame after the clear (there is no persisted state), and the skills stay
   out of the injection precisely so the overview can be stable-and-shared.
   But if you'd rather trim, the seam is clean (overview is one file).

4. **`/wayfinder <map>` on an open map: chart-continue or work-the-map?** The
   dispatch table above collapses them into "work the map." They overlap (both
   grill toward the destination), so **recommended:** treat them as **one** —
   the `map` skill handles "chart if the destination/children are incomplete,
   else drive phase composites." Flagging because today they are distinct
   command paths.

5. **`--help` content.** Per `AGENTS.md`, every route needs a `--help`. The
   `wayfinder` command's `--help` should carry the dispatch table (it is the
   replacement for the deleted `/to-spec`/`/implement` surfaces).
   **Recommended:** yes — the dispatch table *is* the help text. No fork; just
   noting it lands here.

**My recommendation overall:** the skeleton holds together — the five
decisions compose cleanly into *one command + compact overview + 13 skills +
the taxonomy table*. Fog #1 (resolution locus) and #2 (skill selection) are
**resolved** by moving ref-resolution to the agent (supports number/URL/
description/nothing uniformly). The remaining fog (3–5) is mostly "confirm the
obvious" rather than forks. If you agree, I close [#109](https://github.com/BowerJames/mypi/issues/109) as
*design confirmed* and the map is left with just [#110](https://github.com/BowerJames/mypi/issues/110)
(migration) on the frontier — at which point the map is spec-ready (its
destination). If any of 3–5 is a real wrinkle for you, tell me which and I'll
either adjust the skeleton or graduate it into a fresh decision ticket.
