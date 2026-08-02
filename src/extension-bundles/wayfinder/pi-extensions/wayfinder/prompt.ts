/**
 * Doctrine builders for the wayfinder extension.
 *
 * The two commands inject these as one-off context messages (like
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

// ---------------------------------------------------------------------------
// Shared sections
// ---------------------------------------------------------------------------

const PRIMITIVES_SECTION = `### Primitives

Every ticket is one of five primitive types — each carries a \`wayfinder:<type>\` label on a real tracker, or a \`Type:\` line locally. The **map** is a single parent issue/file; its tickets are its children.

- **Wayfinder Map** (\`wayfinder:map\` / \`Type: map\`) — the index: Destination · Notes · Decisions so far · Not yet specified · Out of scope. It gists and links; each decision lives in exactly one place — its ticket. Closed only when the map **and** every child ticket is closed.
- **Decision** (\`wayfinder:decision\` / \`Type: decision\`) — resolve a decision. Worked by grilling the user one question at a time, with a recommended answer for each; you never answer for the human. Closed when the decision is made.
- **Prototype** (\`wayfinder:prototype\` / \`Type: prototype\`) — raise the fidelity of the discussion with a cheap, rough artifact the user can react to (an outline, a stub, UI/logic code). Scaffold a worktree at \`~/.worktrees/<map-slug>/<ticket-slug>/\` and build there. Closed when the user confirms a design, **or** new primitives are spun off to push the fog back further.
- **Research** (\`wayfinder:research\` / \`Type: research\`) — investigate a question against **primary sources** (official docs, source code, specs, first-party APIs) and capture the findings. Closed when the fog is pushed back enough that the correct new primitives can be created. (Research sessions are **not** auto-launched — the user spawns a session and points it at the ticket, like any other.)
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
		trackerOpsSection(input.tracker, input.repo),
	].join("\n");
}
