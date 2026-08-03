/**
 * Doctrine builders for the wayfinder extension.
 *
 * The three commands inject these as one-off context messages (like
 * `llm-wiki`'s `/wiki-ingest`/`/wiki-query`/`/wiki-lint`): the extension
 * detects the tracker at runtime and composes the doctrine with the correct
 * tracker operations, so this is the single source of truth — no separate
 * tracker adapter documents, no `SKILL.md` duplicate.
 *
 * Pure & unit-testable — takes the detected `tracker` + `repo` (+ `ticketRef`
 * for the ticket doctrine) and returns the message body.
 */

import type { TrackerKind } from "./tracker.js";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ChartDoctrineInput {
	tracker: TrackerKind;
	/** The cwd's directory name — used only in the local tracker ops. */
	repo: string;
}

export interface TicketDoctrineInput {
	tracker: TrackerKind;
	repo: string;
	/** The user-supplied ticket reference (issue number/URL, or a local path). */
	ticketRef: string;
}

export interface SpecDoctrineInput {
	tracker: TrackerKind;
	repo: string;
	/**
	 * The user-supplied map reference (issue number/URL on a tracker, or an
	 * effort slug/path on the local tracker) — the closed map to convert.
	 */
	mapRef: string;
}

// ---------------------------------------------------------------------------
// Shared sections
// ---------------------------------------------------------------------------

const PRIMITIVES_SECTION = `### Primitives

Every ticket is one of five primitive types — each carries a \`wayfinder:<type>\` label on a real tracker, or a \`Type:\` line locally. The **map** is a single parent issue/file; its tickets are its children.

- **Wayfinder Map** (\`wayfinder:map\` / \`Type: map\`) — the index: Destination · Notes · Decisions so far · Not yet specified · Out of scope. It gists and links; each decision lives in exactly one place — its ticket. Closed only when the map **and** every child ticket is closed.
- **Decision** (\`wayfinder:decision\` / \`Type: decision\`) — resolve a decision. Worked by grilling the user one question at a time, with a recommended answer for each; you never answer for the human. Closed when the decision is made.
- **Prototype** (\`wayfinder:prototype\` / \`Type: prototype\`) — raise the fidelity of the discussion with a cheap, rough artifact the user can react to (an outline, a stub, UI/logic code). Scaffold a worktree at \`~/.worktrees/<map-slug>/<ticket-slug>/\` and build there. Closed when the user confirms a design, **or** new primitives are spun off to push the fog back further.
- **Research** (\`wayfinder:research\` / \`Type: research\`) — investigate a question against **primary sources** (official docs, source code, specs, first-party APIs) and capture the findings. When a Research ticket is *worked*, it first **grills for its starting sources** — the **external/credentialled** entry points the agent can't reach itself (documentation URLs, external repo/file paths, API endpoints with credentials, version/date bounds) — records them on the ticket, then investigates against them; repo-internal sources (its own code, specs, configs) it reads **directly**, not grilled. Closed when the fog is pushed back enough that the correct new primitives can be created. (Research sessions are **not** auto-launched — the user spawns a session and points it at the ticket, like any other.)
- **Task** (\`wayfinder:task\` / \`Type: task\`) — manual work that must happen *before* a decision can be made (provision access, sign up for a service so its API can be judged, move data so its shape can be seen). Nothing to decide, prototype, or research, but the discussion is blocked until it's done. Drive it yourself where you can; otherwise hand the user a precise checklist. Closed when the work is done; the resolution records what was done and any resulting facts (credentials location, new URLs, row counts).`;

const DOCTRINE_PREAMBLE = `### Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off.

### Fog of war

The map is deliberately incomplete. Beyond the live tickets lies the **fog** — decisions you can sense coming but can't yet pin down, because they hang on questions still open. The test is whether you can **state the question precisely now**: make it a ticket if yes (even if blocked), else write it under *Not yet specified*. Resolving a ticket clears the fog ahead of it, **graduating** what's now specifiable into fresh tickets — one at a time, until the way to the destination is clear.

Fog only gathers *toward* the destination. Work beyond it is **out of scope** — ruled out, not fog. When a ticket turns out to sit past the destination, close it and leave one line in *Out of scope* (gist + why). Out-of-scope work never graduates.

### Refer by name

In everything the human reads, refer to every map and ticket by its **title**, never a bare id or number — a wall of \`#42, #43\` is illegible. The id/URL rides *inside* the name (as its link); it never stands in for it.`;

const GRILLING_SECTION = `### Grilling

To pin down a destination or resolve a Decision ticket, grill the user **relentlessly**:

- Ask **one** question, then wait for the answer before continuing. Multiple questions at once are bewildering.
- Walk down each branch of the decision tree, resolving dependencies one by one.
- For each question, give your **recommended answer** so the user can accept it in a word.
- If a *fact* can be found by exploring the environment (filesystem, \`gh\`/\`glab\`, docs), look it up rather than asking. The *decisions* are the user's — put each one to them and wait.
- For the chart flow, go **breadth-first**: fan out across the whole space rather than deep on any one thread.
- Don't act until you've reached a shared understanding.`;

/**
 * The ticket-only Research workflow. Appended to the ticket doctrine (alongside
 * the Primitives / plan-fog-refer-by-name / grilling / tracker-ops sections) —
 * **not** the chart, spec, or implement doctrines. Sources are grilled and
 * recorded *before* investigation; an empty source set is a hard gate that
 * routes through the existing Blocked / Task / *Not yet specified* seams.
 */
const RESEARCH_WORKFLOW_SECTION = `### Research workflow

A Research ticket is worked in a fixed order — **sources before investigation**:

1. **Check for an existing \`## Sources\`.** Read the ticket body (and its comments). If a \`## Sources\` heading already exists, the sourcing has been done — **confirm once** that it is still the intended set, then skip to step 5. A re-run never re-grills.
2. **Grill for external/credentialled entry points, one at a time.** Ask the user **one** question at a time, each with a **recommended answer**, for the entry points you can't reach yourself: documentation URLs; external repo/file paths; API endpoints (with any credentials, or where to find them); version/date bounds. These are **sources only** — the research *question* stays as written; ask no sub-questions, and pin no output shape. Repo-internal sources (your own code, specs, configs) you read **directly** — never grill for them. (Reuse the one-question-at-a-time, recommended-answer style from the Decision grilling above.)
3. **Record \`## Sources\`.** Write the agreed sources to the ticket as a \`## Sources\` section (a \`##\`-headed section paralleling the existing \`## Answer\` resolution heading), **before** any investigation — so the agent commits to a source set rather than drifting mid-investigation. On a hosted tracker every comment is read, so \`## Sources\` flows to the downstream spec stage with no extra wiring.
4. **Hard gate — refuse to investigate on an empty source set.** If no external/credentialled source is supplied, **do not investigate**. Instead record the ticket **blocked** and push it forward through the existing seams — suggest a **Task** (gather candidate resources), or move the question to the map's *Not yet specified*. No new state: this reuses the existing Blocked / Task / *Not yet specified* machinery.
5. **Investigate against the recorded sources.** Now research the question against the recorded \`## Sources\`, reading each one and capturing the findings.
6. **Resolve and graduate as normal.** Post the findings as an \`## Answer\` (the resolution heading), close the ticket, and append a one-line pointer to the map's *Decisions so far*. Graduate any newly-specifiable fog into fresh tickets (create-then-wire); clear each graduated patch from *Not yet specified*.`;

// ---------------------------------------------------------------------------
// Tracker operations
// ---------------------------------------------------------------------------

function githubOps(): string {
	return `### Tracker operations — GitHub Issues

Use the \`gh\` CLI for everything. The repo is inferred from \`git remote\` (automatic inside a clone).

- **Map**: \`gh issue create --label wayfinder:map --title "<destination>" --body "<…>"\` (use a heredoc for multi-line bodies).
- **Child ticket**: \`gh issue create --label wayfinder:<type> --title "<question>" --body "Part of #<map>

## Question
<…>"\`, then link it to the map as a sub-issue (\`gh api --method POST repos/<owner>/<repo>/issues/<map>/sub_issues -F sub_issue_id=<child-id>\` where sub-issues are available), otherwise add it to a task list in the map body and keep \`Part of #<map>\` at the top.
- **Blocking** (native, UI-visible): \`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>\`, where \`<blocker-db-id>\` is the blocker's numeric **database id** (\`gh api repos/<owner>/<repo>/issues/<n> --jq .id\`, not the \`#number\`). Fallback where dependencies are unavailable: a \`Blocked by: #<n>, #<n>\` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Claim**: \`gh issue edit <n> --add-assignee @me\` before any work.
- **Resolve**: \`gh issue comment <n> --body "<answer>"\`, then \`gh issue close <n>\`, then append a one-line pointer (gist + link) to the map's *Decisions so far*.
- **Frontier**: the map's open children that are unblocked (\`issue_dependencies_summary.blocked_by\` empty, or no open issue in a \`Blocked by\` line) and unassigned; first in map order wins.
- **Read**: \`gh issue view <n> --comments\`. \`<ticket-ref>\` is an issue number or URL.
- **Find maps/tickets**: \`gh issue list --label wayfinder:map\` (and \`--label wayfinder:<type>\` for a type).`;
}

function gitlabOps(): string {
	return `### Tracker operations — GitLab Issues

Use the [\`glab\`](https://gitlab.com/gitlab-org/cli) CLI for everything. GitLab calls comments "notes".

- **Map**: \`glab issue create --label wayfinder:map --title "<destination>" --description "<…>"\` (use a heredoc / \`--description -\` for multi-line).
- **Child ticket**: \`glab issue create --label wayfinder:<type> --title "<question>" --description "Part of #<map>

## Question
<…>"\`.
- **Blocking** (native, UI-visible): post the \`/blocked_by #<n>\` quick action as a note (\`glab issue note <child> --message "/blocked_by #<blocker>"\`) — a Premium/Ultimate feature. On the free tier (or where unavailable) fall back to a \`Blocked by: #<n>, #<n>\` line at the top of the description. A ticket is unblocked when every blocker is closed.
- **Claim**: \`glab issue update <n> --assignee @me\` before any work.
- **Resolve**: \`glab issue note <n> --message "<answer>"\`, then \`glab issue close <n>\` (\`close\` takes no comment — post the note first), then append a one-line pointer to the map's *Decisions so far*.
- **Frontier**: the map's open children (\`glab issue list -F json\` scoped to the map) that are unblocked and unassigned; first in map order wins.
- **Read**: \`glab issue view <n> --comments\`. \`<ticket-ref>\` is an issue number or URL.`;
}

function localOps(repo: string): string {
	return `### Tracker operations — Local Markdown (ephemeral)

Maps and tickets live as files under \`/tmp/.wayfinder/${repo}/\` — **ephemeral** scratch (wiped on reboot, never committed). This is the fallback for a repo without a GitHub/GitLab remote. The effort directory name (\`<effort-slug>\`) is derived from the destination/map title (slugified).

- **Map**: write \`/tmp/.wayfinder/${repo}/<effort-slug>/map.md\` with the body template (Destination / Notes / Decisions so far / Not yet specified / Out of scope).
- **Child ticket**: write \`/tmp/.wayfinder/${repo}/<effort-slug>/issues/NN-<slug>.md\` (numbered from \`01\`), carrying near the top:
  - \`Type: <map|decision|prototype|research|task>\`
  - \`Status: <open|claimed|resolved>\`
  - \`Blocked by: NN, NN\` (the numbers it depends on, or omit)
  - a \`## Question\` body.
- **Claim**: set \`Status: claimed\` and save before any work.
- **Resolve**: append an \`## Answer\` heading with the resolution, set \`Status: resolved\`, then append a one-line pointer (gist + link) to \`map.md\`'s *Decisions so far*.
- **Frontier**: scan \`<effort>/issues/\` for files that are \`Status: open\`, unblocked (every \`Blocked by\` number is \`resolved\`), and unclaimed; lowest number wins.
- **Read**: \`read\` the file at its path. \`<ticket-ref>\` is the path to the issue file (run \`ls /tmp/.wayfinder/${repo}/\` to find efforts and their tickets).
- **Map complete**: the map is done when every file in \`<effort>/issues/\` is \`Status: resolved\`.`;
}

/**
 * The tracker-specific operations section, selected by the detected tracker.
 * The local section templates in the repo slug (the cwd's directory name).
 */
export function trackerOpsSection(tracker: TrackerKind, repo: string): string {
	switch (tracker) {
		case "github":
			return githubOps();
		case "gitlab":
			return gitlabOps();
		default:
			return localOps(repo);
	}
}

// ---------------------------------------------------------------------------
// Doctrine builders
// ---------------------------------------------------------------------------

/**
 * The doctrine injected by `/wayfinder`: chart the map. Grill the destination,
 * map the frontier breadth-first, create the map + the primitive tickets you
 * can specify now, wire blocking in a second pass, then stop (charting
 * resolves nothing).
 */
export function buildChartDoctrine(input: ChartDoctrineInput): string {
	return [
		"## Wayfinder — chart the map",
		"",
		"You are charting a **wayfinder map** for an effort too big for one session and wrapped in fog. You **plan, you don't do**: this session creates the map and its first tickets, then stops — it resolves nothing. Produce decisions, not deliverables.",
		"",
		PRIMITIVES_SECTION,
		"",
		DOCTRINE_PREAMBLE,
		"",
		"### Flow",
		"",
		"1. **Grill the destination.** The destination is what reaching the end of this map looks like (a spec to hand off, a decision to lock, or a change made in place). Name it first — it fixes the scope every ticket is measured against. Use the grilling rules below.",
		"2. **Map the frontier, breadth-first.** Fan out across the whole space rather than going deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog**, the journey is small enough to skip the map — stop and tell the user how they'd like to proceed.",
		"3. **Create the map** (the `wayfinder:map` parent) with Destination and Notes filled in, *Decisions so far* empty, and the fog sketched into *Not yet specified*.",
		"4. **Create the primitive tickets you can specify now** as children of the map — then **wire blocking in a second pass** (issues need ids before they can reference each other). Everything you can't yet specify stays in *Not yet specified*; don't pre-slice the fog into ticket-sized pieces.",
		"5. **Stop.** Charting is one session's work.",
		"",
		GRILLING_SECTION,
		"",
		trackerOpsSection(input.tracker, input.repo),
	].join("\n");
}

/**
 * The doctrine injected by `/wayfinder <ticket-ref>`: work a specific ticket.
 * Read it, detect its primitive type, claim it, apply the matching workflow,
 * resolve it, and graduate any newly-specifiable fog.
 */
export function buildTicketDoctrine(input: TicketDoctrineInput): string {
	return [
		"## Wayfinder — work a ticket",
		"",
		`You are working a specific wayfinder ticket: \`${input.ticketRef}\`.`,
		"",
		"1. **Read the ticket** at that reference, and find its parent map (on a real tracker, the `Part of #<map>` line or the sub-issue link; locally, the `map.md` one directory up from the issue file). Re-orient to the destination before choosing what to do.",
		"2. **Detect its type** from the `wayfinder:<type>` label (or the `Type:` line locally) — one of `decision`, `prototype`, `research`, `task`.",
		"3. **Claim it** (assign to yourself / set `Status: claimed`) before any work, so concurrent sessions skip it.",
		"4. **Apply the matching workflow** (see Primitives below). If in doubt for a Decision, grill.",
		"5. **Resolve it**: post the answer as a resolution (a comment / an `## Answer` heading), close the ticket, and append a one-line pointer (gist + link) to the map's *Decisions so far*.",
		"6. **Graduate the fog**: if the resolution makes new tickets specifiable, create them (create-then-wire) and clear each graduated patch from *Not yet specified*. If it reveals a ticket — this one or another — sits beyond the destination, rule it **out of scope** (close it, leave one line in *Out of scope*) rather than resolving it on the route.",
		"",
		"**One ticket per session** (research excepted in the original, but research is now user-spawned and pointed at a ticket, so you still work one at a time).",
		"",
		PRIMITIVES_SECTION,
		"",
		DOCTRINE_PREAMBLE,
		"",
		GRILLING_SECTION,
		"",
		RESEARCH_WORKFLOW_SECTION,
		"",
		trackerOpsSection(input.tracker, input.repo),
	].join("\n");
}

// ---------------------------------------------------------------------------
// /to-spec — map → spec issue stage
// ---------------------------------------------------------------------------
//
// The spec stage (wayfinder map #48). Mirrors buildChartDoctrine /
// buildTicketDoctrine but drives *synthesis*, not grilling: read a closed map's
// durable inputs, fill the verbatim 7-section template, and publish a
// `wayfinder:spec` successor issue in one shot. Wired to the seven decisions:
//   #49 durable inputs (+ ingest prototype/research as a digest)
//   #50 pure one-shot, no confirm gate
//   #51 lives in the wayfinder bundle, command `/to-spec <map-ref>`
//   #52 `wayfinder:spec` successor issue, linked both ways, map closes first
//   #53 adopt upstream's 7-section template verbatim; seams = process, not a section
//   #55 re-run overwrites the spec body in place (stable URL / successor link)
//   #56 issue body only — never write/commit a repo file

/**
 * The spec template, adopted verbatim from `mattpocock/skills` `to-spec`
 * (decision #53). Structural/content fidelity to the source; terminology is
 * aligned to wayfinder at the *doctrine* layer, so the template body is
 * untouched. The spec stage fills this in.
 */
const SPEC_TEMPLATE = `## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.`;

/**
 * The seams / deep-module concept, carried as **process guidance** in the
 * doctrine — not edited into the Testing Decisions section (decision #53).
 * Used while filling *Implementation Decisions* and *Testing Decisions*.
 */
const SEAMS_SECTION = `### Seams / deep-module (process, not a section)

While filling *Implementation Decisions* and *Testing Decisions*, reason about **seams** — the boundaries where tests and change can hook in — and prefer a **deep module** (a narrow interface hiding a wide implementation):

- **Sketch the seams first.** For each piece of the solution, name where it joins the rest of the system (a function signature, a CLI surface, an event, a label). A good seam is narrow and stable.
- **Prefer an existing seam to a new one.** If the codebase already exposes a join point that fits (an existing command, hook, doctrine builder, manifest field), route through it rather than inventing a parallel one. State which existing seam you reused.
- **Push to the highest seam possible.** Hook as close to the edge as you can (a public command, a label, a config) before reaching into internals — the higher the seam, the less the spec couples to today's implementation.
- **Ideal is one seam per concern.** If a decision implies several overlapping seams, prefer collapsing them; flag any that can't be collapsed as open risk.

Record the chosen seams as part of the relevant decision ("routes through the existing X seam"), not as a separate section.`;

function githubSpecOps(): string {
	return `### Tracker operations — GitHub Issues (spec synthesis)

The spec is a \`wayfinder:spec\` **successor** issue — produced, not resolved, so it is **not** a child of the map (do not use the sub-issues link). Use the \`gh\` CLI; the repo is inferred from \`git remote\`.

- **Eligibility gate (map must be closed).** Before synthesising: confirm the map is closed (\`gh issue view <map> --json state --jq .state\` → \`CLOSED\`) and every child is closed (each sub-issue / \`Part of #<map>\` ticket is \`CLOSED\`). If any is open, **stop** — name the still-open ticket and tell the user the stage runs only once map + all children are closed. Do not synthesise against an open map.
- **Synthesise from durable inputs only.** Read the map body (Destination · Notes · Decisions so far · Out of scope) via \`gh issue view <map>\`, and **every closed child ticket's resolution comment** via \`gh api repos/<owner>/<repo>/issues/<n>/comments --jq '.[].body'\`. Add targeted codebase exploration. Do **not** read the live conversation — the stage is re-runnable from the map alone.
- **Ingest prototype/research as a digest.** Where a closed child is a prototype or research ticket, fold a summary of what it *proved/concluded* into the relevant spec section — not verbatim, and not a bare link (the spec must stay self-contained if a worktree is wiped).
- **Create the spec successor (first run).** \`gh issue create --label wayfinder:spec --title "<map title> — spec" --body "<rendered spec>"\`. The body opens with \`Spec for #<map>\`. Link both ways: the spec body already carries \`Spec for #<map>\`, and you add a \`Spec: #<spec>\` pointer to the **map body** (\`gh issue edit <map> --body "<updated map body>"\`).
- **Re-run = overwrite in place.** If a \`wayfinder:spec\` issue referencing the map already exists (\`gh issue list --label wayfinder:spec --search "Spec for #<map>"\`), re-synthesise and \`gh issue edit <spec> --body "<re-synthesised spec>"\` — same issue, stable URL, stable successor link. Do **not** mint a new issue; do **not** refuse.
- **Never write the repo.** \`/to-spec\` creates/edits only the \`wayfinder:spec\` issue (+ its label + the two-way successor links). It must not \`write\`/commit any repo path — no \`docs/specs/\` mirror, ever.
- **No confirm gate.** Publish the spec issue immediately on invocation. There is no preview-and-confirm step; recovery is downstream (re-run, or edit the published issue).`;
}

function gitlabSpecOps(): string {
	return `### Tracker operations — GitLab Issues (spec synthesis)

The spec is a \`wayfinder:spec\` **successor** issue — produced, not resolved, so it is **not** a child of the map. Use the [\`glab\`](https://gitlab.com/gitlab-org/cli) CLI; GitLab calls comments "notes".

- **Eligibility gate (map must be closed).** Confirm the map is closed (\`glab issue view <map>\` shows \`closed\`) and every child is closed. If any is open, **stop** — name it and tell the user the stage runs only once map + all children are closed.
- **Synthesise from durable inputs only.** Read the map description (Destination · Notes · Decisions so far · Out of scope) and **every closed child ticket's resolution note** (\`glab issue view <n> --comments\`). Add targeted codebase exploration. Do not read the live conversation.
- **Ingest prototype/research as a digest** folded into the relevant section.
- **Create the spec successor (first run).** \`glab issue create --label wayfinder:spec --title "<map title> — spec" --description "<rendered spec>"\`; the description opens with \`Spec for #<map>\`. Link both ways: add a \`Spec: #<spec>\` pointer to the map description (\`glab issue update <map> --description "<updated>"\`).
- **Re-run = overwrite in place.** Find the existing spec (\`glab issue list -l wayfinder:spec\`), then \`glab issue update <spec> --description "<re-synthesised spec>"\` — same issue, stable URL. Do not mint a new issue.
- **Never write the repo.** Create/edits only the \`wayfinder:spec\` issue. No repo file, ever.
- **No confirm gate.** Publish immediately; recover downstream.`;
}

function localSpecOps(repo: string): string {
	return `### Tracker operations — Local Markdown (spec synthesis)

The map lives at \`/tmp/.wayfinder/${repo}/<effort-slug>/map.md\`; the spec is written as a sibling file \`<effort>/spec.md\` (not under \`issues/\` — it is a successor, not a child primitive). All ephemeral.

- **Eligibility gate (map must be closed).** The local map has no \`state\`; a map is "closed" when every file in \`<effort>/issues/\` is \`Status: resolved\`. If any is not, **stop** — name it and tell the user to resolve it first.
- **Synthesise from durable inputs only.** Read \`map.md\` and each resolved ticket file's \`## Answer\`. Add targeted codebase exploration. Do not read the live conversation.
- **Ingest prototype/research as a digest** folded into the relevant section.
- **Create the spec successor (first run).** Write \`<effort>/spec.md\` whose first line is \`Spec for: <map title>\`, then the rendered spec. Link back from the map by appending a \`Spec: <effort>/spec.md\` line to \`map.md\`.
- **Re-run = overwrite in place.** Overwrite \`<effort>/spec.md\` with the re-synthesised spec; keep the \`Spec:\` pointer in \`map.md\`. Do not version.
- **Never write the repo.** Everything stays under \`/tmp/.wayfinder/\` (ephemeral, never committed). No repo file.
- **No confirm gate.** Write the spec file immediately; recover by re-running or editing.`;
}

/** Spec-stage tracker ops, selected by the detected tracker. */
export function specTrackerOpsSection(tracker: TrackerKind, repo: string): string {
	switch (tracker) {
		case "github":
			return githubSpecOps();
		case "gitlab":
			return gitlabSpecOps();
		default:
			return localSpecOps(repo);
	}
}

/**
 * The doctrine injected by \`/to-spec <map-ref>\`: convert a **closed** wayfinder
 * map into a spec issue — a PRD-style hand-off. Read the durable inputs, fill
 * the verbatim 7-section template, and publish a \`wayfinder:spec\` successor
 * issue in one shot (no confirm gate); re-run overwrites in place. This stage
 * synthesises — it does not grill, create wayfinder tickets, or write the repo.
 */
export function buildSpecDoctrine(input: SpecDoctrineInput): string {
	return [
		"## Wayfinder — convert a closed map to a spec",
		"",
		`You are running \`/to-spec ${input.mapRef}\`: converting a **completed** wayfinder map into a **spec issue** — a PRD-style hand-off to the build chain. You synthesise; you do not grill, you do not create wayfinder tickets, you do not change the repo.`,
		"",
		"### Flow",
		"",
		"1. **Gate on eligibility.** The map must be closed — map + every child resolved. If any is open, stop and name it; do not synthesise against an open map.",
		"2. **Gather the durable inputs** — the map body (Destination · Notes · Decisions so far · Out of scope) and **every closed child ticket's resolution**. Add targeted codebase exploration. Ignore the live conversation: the stage is re-runnable from the map alone.",
		"3. **Ingest prototype/research as a digest.** Where a closed child is a prototype or research ticket, fold a summary of what it *proved/concluded* into the relevant section — not verbatim, not a link.",
		"4. **Fill the template** (verbatim below) from those inputs. Refer to every map and ticket by its **title** (the id rides inside the name as its link) — a wall of `#42, #43` is illegible in a hand-off doc.",
		"5. **Publish in one shot.** Create (or, on re-run, overwrite in place) the `wayfinder:spec` successor issue and link it both ways. No preview-and-confirm gate — publish immediately; recovery is downstream.",
		"6. **Stop.** The spec is the hand-off. Its acceptance/implementation lifecycle is downstream (out of scope for this stage).",
		"",
		"### The spec template (fill this in)",
		"",
		SPEC_TEMPLATE,
		"",
		SEAMS_SECTION,
		"",
		specTrackerOpsSection(input.tracker, input.repo),
	].join("\n");
}

// ---------------------------------------------------------------------------
// /implement — spec → merged, reviewed code stage (spec #74)
// ---------------------------------------------------------------------------
//
// A third one-shot doctrine injector in the wayfinder bundle — one command,
// /implement <ref>, that auto-disambiguates by the reference it is given:
//   - /implement <closed-spec-ref>  → kickoff: slice the spec into Development
//                                     units, then (on confirm) cut the trunk,
//                                     create the Implementation Map + children.
//   - /implement <open-ticket-ref>  → work that ticket through its lifecycle
//                                     (Development → Code Review → Merge, with
//                                     Follow-Up Development and Full Review).
// Pointing it at the Implementation Map itself is an error — redirect.
//
// Same clear-then-inject as /wayfinder and /to-spec (stateless; the trunk is
// recorded in the Implementation Map body, not mode's persisted /root-branch).
// Reviews are in-band doctrine (no subprocess, no code-review bundle reuse).

export interface ImplementDoctrineInput {
	tracker: TrackerKind;
	repo: string;
	/**
	 * The user-supplied reference: a **closed** `wayfinder:spec` (→ kickoff) or
	 * any **open** wayfinder implementation ticket (→ work that ticket).
	 */
	ref: string;
}

const IMPLEMENT_PRIMITIVES_SECTION = `### Implementation primitives

Six build primitives under the existing \`wayfinder:\` label prefix — parallel to the planning six. Each carries a \`wayfinder:<type>\` label on a real tracker (or a \`Type:\` line locally). The **Implementation Map** is a single parent issue/file — the index *and* the root branch; its tickets are its children.

| Primitive | Label | One-line semantics |
|---|---|---|
| **Implementation Map** | \`wayfinder:implementation-map\` | The index **and** the root branch; closes only when it and all its children are closed. |
| **Development** | \`wayfinder:development\` | One isolated unit of dev on its own branch; on completion spawns a Code Review. |
| **Code Review** | \`wayfinder:code-review\` | Reviews a Development branch; on pass spawns a Merge, on fail spawns a Follow-Up Development. |
| **Follow-Up Development** | \`wayfinder:follow-up-development\` | Addresses review findings on the parent Development branch; loops back to Code Review. |
| **Merge** | \`wayfinder:merge\` | Merges the dev branch → root branch; only startable after an approved Code Review; closes the Development ticket on completion. |
| **Full Review** | \`wayfinder:full-review\` | Reviews the integrated root branch vs the full spec; only when all other impl tickets are closed; on pass closes the Implementation Map. |

\`wayfinder:implementation-map\` is intentionally **distinct** from the planning \`wayfinder:map\` (different body — it records the root branch — and a different close condition).

### Lifecycle / transition table

\`/implement <ref>\` auto-disambiguates by the reference's label + state: a *closed* \`wayfinder:spec\` → **kickoff**; any *open* implementation ticket → **work**, dispatched by primitive type per the table below. Pointing \`/implement\` at the \`wayfinder:implementation-map\` itself is an **error** — redirect to the frontier Development ticket, or to \`/implement <spec-ref>\` to (re-)kickoff.

| Primitive | "Complete" (\`/implement <ref>\`) | Spins off | Closes |
|---|---|---|---|
| \`implementation-map\` | n/a — created only by kickoff; not a work target | Development children (+ Full Review) at kickoff | closed by Full Review on pass |
| \`development\` | switch to its worktree+branch, do the work, commit | Code Review (linked, reads reqs from this Dev) | — (stays open: the unit anchor) |
| \`code-review\` | run in-band review, post findings + non-binding rec, then **user gate** | approve → Merge; rework → Follow-Up Development | **self** (at the gate, pass or fail) |
| \`follow-up-development\` | reuse the parent Dev's branch + worktree (no new branch), commit the rework | Code Review (linked to parent Dev) — loop | **self** (once rework committed) |
| \`merge\` | merge unit branch → root \`implement/<spec-slug>\`, resolve conflicts | — | parent Development + self |
| \`full-review\` | verify no other impl ticket open, review integrated root vs full spec; on pass **close map + self; leave the root→base merge to the user** | on rework → fresh Development children | Implementation Map + self |

**Closure rules (single-owner, no orphans):** Code Review self-closes at its gate (approve *or* rework); Follow-Up self-closes once its rework is committed (it does not wait for its review to pass); Development stays open until Merge (it is the unit anchor Merge consumes); Merge closes the parent Dev + itself (Follow-Ups and Code Reviews are already self-closed, so Merge does **not** touch them); the Implementation Map closes only at Full Review.

**Eligibility guards — all structural / soft-doctrine; no native \`blocked_by\` inside the lifecycle.** "Merge after approved Code Review" holds by construction (a Merge is only ever spawned by a passing Code Review's gate). "Full Review after all else closed" is a **runtime check** — the child set is dynamic (Follow-Ups and failed-review Dev tickets appear mid-effort), so it cannot be encoded as static blocker IDs; Full Review is created at kickoff carrying a soft, recomputed \`Blocked by: all other implementation tickets closed\` line, mirroring the Code Review's soft \`Blocked by: commits on <dev-branch>\` convention.`;

const IMPLEMENT_BRANCHING_SECTION = `### Branching & namespace

- **Per-effort integration trunk** \`implement/<spec-slug>\`, **cut from the current branch at kickoff** (whatever \`HEAD\` is on — captured via \`git branch --show-current\`, recorded in the Implementation Map body as \`Base branch:\`, **not** hardcoded to \`develop\`/\`main\` and **not** \`mode\`'s persisted \`/root-branch\`). Created at kickoff, **after** the user confirms the proposal. All dev units of one effort integrate against this one stable branch.
- **One namespace, keyed on the spec slug** (the stable, human-named kickoff anchor — not the Implementation-Map slug): trunk \`implement/<spec-slug>\`; dev-unit branch \`dev/<spec-slug>/<n>-<slug>\`; dev-unit worktree \`~/.worktrees/<spec-slug>/<n>-<slug>\`. \`<n>\` is the tracker ticket number, **raw (no zero-padding)** — numbers climb into the hundreds/thousands, so fixed-width padding would be inconsistent. \`git branch | grep <spec-slug>\` finds the trunk and every unit at once; the worktree path mirrors the branch name under \`~/.worktrees/\`.
- **Development units are worktrees-on-branches.** Each unit is a branch plus a dedicated worktree (a checkout of that branch) so multiple units run in parallel without contending for one working tree. The worktree is an isolated checkout **of** the branch, not a substitute for it.
- **Lazy materialisation.** At kickoff, each dev unit's *planned* branch + worktree **paths** are recorded on its ticket (names deterministic); the **trunk** is cut at kickoff after confirmation; each dev **branch + worktree is materialised only when \`/implement <ticket-ref>\` starts work on that unit** — \`git branch <dev-branch> <base>\` then \`git worktree add <worktree-path> <dev-branch>\`. Do not create N working trees for units not yet in flight.
- **Final trunk→base merge is the user's.** Full Review is the **approval** gate, not the landing step — record on the Full Review ticket that the trunk is approved and ready to land, and leave the merge into the base branch to the user. Consistent with wayfinder's "plans, doesn't build" / "you never answer for the human."`;

const IMPLEMENT_KICKOFF_SECTION = `### Kickoff (\`/implement <closed-spec-ref>\`)

1. **Eligibility gate — refuse-and-name.** The ref must be a **closed** \`wayfinder:spec\`. On failure, refuse and name the exact problem: open spec → "close it first"; not a spec → "run \`/to-spec <map-ref>\` first"; unresolvable ref → usage error. No \`--force\`, mirroring \`/to-spec\`'s usage guard.
2. **Propose-then-create.** Read the full spec + do targeted codebase exploration, lay out the proposed **slice** (the Development units) + an **ordering**, and **wait for a yes/no**. **Nothing is created until confirmed** — no ticket, branch, or worktree. Re-slicing is cheap while still a proposal; noisy once tickets/branches/worktrees exist.
3. **Coarse-by-default slicing**, cut along seams/modules honouring the spec's Implementation Decisions. **Split only on genuine file/seam independence** — the test is whether two units touch the same files or would create merge-conflict storms landing on the trunk; if yes, they are not independent and stay as **one** Development ticket. By construction the dev units are independently mergeable, so **no inter-unit blocking dependencies are wired** — ordering is a suggestion (which to work first), not a block.
4. **Lazy materialisation** (see Branching): record each unit's planned branch + worktree *paths* on its ticket; cut only the trunk at kickoff.
5. **Development ticket body** — self-contained on *what/where*, points at the spec for *how/why* (no wholesale excerpt, so the spec stays canonical and un-drifted): \`Part of #<implementation-map>\` + link to the source spec; **slice scope** (seam/module owned + files expected to touch); **acceptance boundary** (a testable "done for this unit", distilled from the relevant User Stories + Testing Decisions); **spec pointers** (which User Story / Implementation Decision / Testing Decision bullets this unit realises — references, not copies); **branch + worktree paths** (planned).
6. **Kickoff sequence** (the post-confirmation create step): capture the current branch (\`git branch --show-current\`) → cut \`implement/<spec-slug>\` from it → create the **Implementation Map** (records \`Root branch: implement/<spec-slug>\` and \`Base branch: <captured>\`) → create each **Development** child (body per above) → wire each as a child of the Implementation Map (\`Part of #<map>\` + task-list, per the map's native-sub-issue-unavailable convention) → create the **Full Review** child carrying \`Blocked by: all other implementation tickets closed\`. Decomposition is then done; the user drives units one at a time via \`/implement <ticket-ref>\`.`;

const IMPLEMENT_REVIEW_SECTION = `### Reviews — in-band doctrine (Code Review & Full Review)

- **Mechanism — in-band doctrine injection.** \`/implement <code-review-ticket>\` (or the Full Review ticket) injects a wayfinder-native review doctrine (a section of this doctrine, selected by primitive type) that turns the current agent into the reviewer for one turn. **No subprocess is spawned and the standalone \`code-review\`/\`code-review-prompt\` bundles are not reused** — the same clear-then-inject pattern as \`/wayfinder\` and \`/to-spec\`. (The existing \`code-review.md\` prompt template is read-only and posts a structured comment, but is deliberately not reused; the wayfinder primitive defines its own doctrine.)
- **Reviewer model — the active session model.** With no subprocess there is nowhere to pass \`--model\`; the reviewer is whatever model the session is running. Switch with \`/model\` beforehand and re-run on a clean slate.
- **Pass/fail — a user gate.** The reviewer posts findings + a **non-binding recommendation**, then stops; it never self-adjudicates. \`/implement <review-ticket>\` asks the user one question — **approve or rework** — so the pass/fail outcome is a user gate, never the agent answering for the human. Code Review: approve → spawn **Merge**; rework → spawn **Follow-Up Development**. Full Review: approve → close map + self, leave the trunk→base merge to the user; rework → spin off fresh **Development** children (recorded on the map), keep the Full Review ticket **open** through rework rounds.
- **Where the review lives — on the review ticket.** The reviewer reads its inputs (Code Review: the linked Development ticket's title + body + comments for requirements; Full Review: the **full closed spec**), diffs the right branches (Code Review: \`<dev-branch>\` vs the root \`implement/<spec-slug>\`; Full Review: the trunk \`implement/<spec-slug>\` vs the **base branch recorded in the Implementation Map**), runs the repo's tests/lint/format on the relevant tree, and posts the structured findings + recommendation as a comment on the review ticket. The ticket body records its inputs (the Dev ticket ref / the spec ref, the dev branch / the trunk, the base branch) so they are self-contained.
- **Eligibility — runnability gates, not creation gates.** A Code Review can be created anytime; it carries a soft \`Blocked by: commits on <dev-branch>\` body line — \`/implement\` checks the branch has ≥1 commit beyond the recorded root, runs the review once it does, and clears the line. Full Review is created at kickoff but carries a soft, recomputed \`Blocked by: open children\` line; it is kept off the frontier until every other Implementation Map child is closed.`;

const IMPLEMENT_MERGE_SECTION = `### Merge — landing a unit on the trunk

- **Git ops, run in the cwd repo** (which holds \`implement/<spec-slug>\` checked out; dev units are linked worktrees sharing its object store, so the dev branch is visible there): \`git checkout implement/<spec-slug>\`, then **\`git merge --no-ff <dev-branch>\`**. \`--no-ff\` always makes a merge commit (carrying the dev-ticket **title** in the message) so each unit's landing is a traceable node — not \`--ff-only\` (no marker) and not \`--squash\` (loses per-commit history).
- **Cleanup on success:** remove the dev worktree (\`git worktree remove <path>\`), delete the merged dev branch with the **guarded \`-d\`** (\`git branch -d <dev-branch>\` — refuses if anything is unmerged), and **push the trunk** (\`git push <remote> implement/<spec-slug>\` on github/gitlab; no-op on local). Conditionally delete a pushed remote dev branch only if one was ever pushed (dev work is local-first). Net: no stray worktree or branch — only the merge commit remains.
- **Conflicts:** trivial → resolve them **with certainty and no semantic judgment** (disjoint additions to different files; or one side clearly supersedes the other), edit, stage (\`git add\`), and \`git commit\` to continue. **Hard → halt and ask, never guess**: stop without resolving, **leave the merge in-progress** (do **not** \`git merge --abort\` — that would throw away the merge context), list the conflicted files + their conflict markers, and hand control to the user to resolve and commit (then re-run \`/implement <merge-ticket>\` to finish). **Never** \`--ours\`/\`--theirs\` to force a side, and **never** commit while conflict markers remain.
- **Closure (asymmetric by intent):** the Merge ticket comments the merge SHA + what landed + cleanup done and closes; the parent **Development** ticket is commented "Merged via [Merge ticket] (commit \`<sha>\`) into \`implement/<spec-slug>\`" and closes (Development tracks the whole unit code→review→follow-ups→landing, so done = landed on the trunk). Follow-Up tickets are already self-closed at their own commit-time; Merge does **not** touch them. The Implementation Map is untouched until Full Review.`;

const IMPLEMENT_STORES_SECTION = `### Two stores: ephemeral tickets, real repo

- **Yes — by separating the two stores.** Tickets live under the existing ephemeral \`/tmp/.wayfinder/<repo>/<effort>/\` scratch (local tracker) or on the tracker (github/gitlab); git branches/merges happen on the **real cwd repo**, which is persistent regardless of tracker. None of the six primitives are tracker-gated: Development is a branch in cwd; Merge is \`git merge\` in cwd (works without a remote — you just cannot \`push\`); the reviews run in-band (tracker-agnostic).
- **Durable record on local.** On github/gitlab the tracker *issue* is the durable record. Local has no durable tracker, so the durable record of a finished effort is the **merged branch in cwd** — its commits and commit messages (referencing ticket **titles**) are the record. Local tickets are planning scratch that may vanish on reboot.
- **INVERSION vs \`/to-spec\`.** \`/implement\` **must write the repo** (branches/merges) on **all three** trackers — the "never write the repo" rule is a \`/to-spec\`-only constraint, deliberately inverted here so the implementation phase produces code on disk.`;

function githubImplementOps(): string {
	return `### Tracker operations — GitHub Issues (implement)

Use the \`gh\` CLI; the repo is inferred from \`git remote\`. Create the six new \`wayfinder:\` labels at first use alongside the existing six (\`gh label create wayfinder:<type>\`).

- **Implementation Map** (kickoff): \`gh issue create --label wayfinder:implementation-map --title "<spec title>" --body "<body>"\`, where the body records \`Root branch: implement/<spec-slug>\`, \`Base branch: <captured>\`, and \`Spec: #<spec>\`. Link children as sub-issues (\`gh api --method POST repos/<owner>/<repo>/issues/<map>/sub_issues -F sub_issue_id=<child-id>\`) where available, else a task list in the map body + \`Part of #<map>\` atop each child.
- **Development child**: \`gh issue create --label wayfinder:development --title "<unit>" --body "<body>"\` — the body carries \`Part of #<map>\`, slice scope, acceptance boundary, spec pointers, and the planned \`branch\` + \`worktree\` paths.
- **Code Review**: \`gh issue create --label wayfinder:code-review --title "Review: <dev-title>" --body "<body>"\` — the body records the Dev ticket ref, \`dev/<spec-slug>/<n>-<slug>\`, \`implement/<spec-slug>\`, and \`Blocked by: commits on dev/<spec-slug>/<n>-<slug>\`.
- **Follow-Up Development**: label \`wayfinder:follow-up-development\`; reuses the parent Dev's branch (no new branch).
- **Merge**: label \`wayfinder:merge\`; the body records the Dev ticket ref and that it merges into \`implement/<spec-slug>\`.
- **Full Review** (created at kickoff): \`gh issue create --label wayfinder:full-review --title "Full Review: <spec title>" --body "<body>"\` — the body records \`Spec: #<spec>\`, \`Trunk: implement/<spec-slug>\`, \`Base branch: <captured>\`, and \`Blocked by: all other implementation tickets closed\`.
- **Read**: \`gh issue view <n> --comments\`. **Frontier**: the map's open, unblocked, unclaimed children; first in map order wins.
- **Close**: \`gh issue comment <n> --body "<resolution>"\` then \`gh issue close <n>\`. Code Review + Follow-Up self-close at their gates; Merge closes itself + its parent Dev; Full Review on approve closes itself + the Implementation Map.`;
}

function gitlabImplementOps(): string {
	return `### Tracker operations — GitLab Issues (implement)

Use the [\`glab\`](https://gitlab.com/gitlab-org/cli) CLI; GitLab calls comments "notes". Create the six new \`wayfinder:\` labels at first use alongside the existing six.

- **Implementation Map** (kickoff): \`glab issue create --label wayfinder:implementation-map --title "<spec title>" --description "<body>"\` — body records \`Root branch: implement/<spec-slug>\`, \`Base branch: <captured>\`, \`Spec: #<spec>\`.
- **Development child**: \`glab issue create --label wayfinder:development --title "<unit>" --description "<body>"\` — body carries \`Part of #<map>\`, slice scope, acceptance boundary, spec pointers, planned branch + worktree.
- **Code Review**: \`glab issue create --label wayfinder:code-review --title "Review: <dev-title>" --description "<body>"\` — body records the Dev ticket ref, the dev branch / root branch, and \`Blocked by: commits on <dev-branch>\`.
- **Follow-Up Development** (\`wayfinder:follow-up-development\`), **Merge** (\`wayfinder:merge\`), **Full Review** (\`wayfinder:full-review\`): same \`glab issue create\` shape; Full Review carries \`Blocked by: all other implementation tickets closed\`.
- **Read**: \`glab issue view <n> --comments\`. **Frontier**: the map's open, unblocked, unclaimed children.
- **Close**: \`glab issue note <n> --message "<resolution>"\` then \`glab issue close <n>\`.`;
}

function localImplementOps(repo: string): string {
	return `### Tracker operations — Local Markdown (implement)

Tickets live as files under \`/tmp/.wayfinder/${repo}/<effort-slug>/\` (ephemeral scratch — wiped on reboot, never committed). Git branches/merges happen on the **real cwd repo** (persistent). The merged branch in cwd is the sole durable record of a finished effort; local tickets are planning scratch.

- **Implementation Map** (kickoff): write \`/tmp/.wayfinder/${repo}/<effort-slug>/implement-map.md\` with \`Type: implementation-map\`, \`Status: open\`, \`Root branch: implement/<spec-slug>\`, \`Base branch: <captured>\`, \`Spec: <effort>/spec.md\`.
- **Development child**: write \`<effort>/issues/<n>-<slug>.md\` (\`Type: development\`, \`Status: open\`, \`Part of: implement-map\`, slice scope / acceptance boundary / spec pointers / planned branch + worktree).
- **Code Review**: \`Type: code-review\`, \`Reviews: <dev>\`, the dev branch / root branch, \`Blocked by: commits on <dev-branch>\`.
- **Follow-Up Development** (\`Type: follow-up-development\`), **Merge** (\`Type: merge\`), **Full Review** (\`Type: full-review\`, \`Blocked by: open children\`) — sibling files under \`<effort>/issues/\`.
- **Frontier**: scan \`<effort>/issues/\` for \`Status: open\` children whose blockers are resolved; lowest number wins.
- **Close**: set \`Status: closed\` and append the resolution. (On local, the durable record is the merged branch in cwd, not these scratch files.)`;
}

/**
 * Implement-stage tracker ops, selected by the detected tracker. The local
 * section templates in the repo slug (the cwd's directory name).
 */
export function implementTrackerOpsSection(tracker: TrackerKind, repo: string): string {
	switch (tracker) {
		case "github":
			return githubImplementOps();
		case "gitlab":
			return gitlabImplementOps();
		default:
			return localImplementOps(repo);
	}
}

/**
 * The doctrine injected by \`/implement <ref>\`: turn a **closed**
 * \`wayfinder:spec\` into merged, reviewed code. \`/implement <ref>\`
 * auto-disambiguates — a closed spec → **kickoff** (propose a slicing, then on
 * confirm cut the trunk + create the Implementation Map and Development
 * children); any open implementation ticket → **work** it through its lifecycle
 * (Development → Code Review → Merge, with Follow-Up Development and Full
 * Review). Same clear-then-inject as \`/wayfinder\` and \`/to-spec\`; stateless
 * (the trunk is recorded in the Implementation Map body, not \`mode\`'s
 * \`/root-branch\`); reviews are in-band doctrine.
 */
export function buildImplementDoctrine(input: ImplementDoctrineInput): string {
	return [
		"## Wayfinder — implement a closed spec",
		"",
		`You are running \`/implement ${input.ref}\` — the wayfinder implementation stage, which turns a **closed \`wayfinder:spec\` issue** into merged, reviewed code. \`/implement <ref>\` **auto-disambiguates** by the reference: a **closed** \`wayfinder:spec\` → **kickoff** (propose a slicing, then on confirm cut the trunk and create the Implementation Map + children); any **open** wayfinder implementation ticket → **work** that ticket through its lifecycle per the transition table. Pointing it at the \`wayfinder:implementation-map\` itself is an **error** — redirect to the frontier Development ticket, or to \`/implement <spec-ref>\` to (re-)kickoff.`,
		"",
		"**Refer by name.** In everything the human reads, refer to every map and ticket by its **title**, never a bare id or number — the id/URL rides *inside* the name (as its link).",
		"",
		IMPLEMENT_PRIMITIVES_SECTION,
		"",
		IMPLEMENT_BRANCHING_SECTION,
		"",
		IMPLEMENT_KICKOFF_SECTION,
		"",
		IMPLEMENT_REVIEW_SECTION,
		"",
		IMPLEMENT_MERGE_SECTION,
		"",
		IMPLEMENT_STORES_SECTION,
		"",
		implementTrackerOpsSection(input.tracker, input.repo),
	].join("\n");
}
