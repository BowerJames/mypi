/**
 * PART A — the ONE command (skeleton). Prototype stub for #109; not wired into
 * the real bundle. Replaces today's three commands (`/wayfinder`, `/to-spec`,
 * `/implement`) with a single `/wayfinder <ref>` (#104).
 *
 * ── Where resolution lives ────────────────────────────────────────────────
 * The command does NOT read the issue in TypeScript. `<ref>` may be a number,
 * a full URL, a *description* of the ticket, or nothing — only the agent can
 * resolve all four (a description needs `gh issue list --search`, which is an
 * LLM judgement, not a static lookup). So the locus is:
 *
 *     command:  detect the TRACKER (today's `git remote` autodetect) so the
 *               overview injects the right tracker-ops section; then clear +
 *               inject the overview + a one-line resolution directive.
 *     agent:    resolve `<ref>` to a ticket (number/URL → `gh issue view`;
 *               description → `gh issue list --search` + disambiguate if many;
 *               nothing → chart), read its label+state, apply the overview's
 *               dispatch table → read the matching skill → act.
 *
 * This supports number/URL/description/nothing UNIFORMLY, and is more faithful
 * to #104 (skills are model-invocable; the model interprets). The dispatch
 * determinism of fog #2 is preserved — label→skill is a FIXED MAP in the
 * overview's dispatch table; the agent applies it after resolving rather than
 * the command pre-naming the skill.
 *
 * The repo-write inversion dissolves into the skills: the `spec` skill says
 * "never write the repo"; the `development`/`merge` skills say "you must write
 * the repo". The command is neutral.
 *
 * TODO (real build): tracker detection reuses today's `detectTracker`; the
 * overview text reuses today's `trackerOpsSection` machinery (github/gitlab/
 * local). `--help` is sketched here as a handler branch.
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { deliverDoctrine } from "./deliver.js"; // unchanged clear-then-inject helper
import { buildOverview } from "./overview/overview.js"; // compact frame + tracker-ops

export default function wayfinderExtension(pi: ExtensionAPI): void {
	pi.registerCommand("wayfinder", {
		description: "Unified wayfinder: chart (/wayfinder) or work a ticket/map by label+state (/wayfinder <ref>)",

		// `/wayfinder --help` carries the dispatch table — the replacement for
		// the deleted `/to-spec` / `/implement` surfaces (AGENTS.md: every route
		// needs a --help). Implemented as a handler branch; the real build may
		// hoist into a dedicated help path.
		handler: async (args, ctx) => {
			const ref = args.trim();

			if (ref === "--help" || ref === "-h") {
				ctx.ui.notify(
					[
						"Usage: /wayfinder [<ref>]   — chart (no arg) or work a ticket/map",
						"",
						"<ref> may be: an issue number, a full issue URL, a description",
						"(resolved via search), or omitted (chart a new map).",
						"",
						"Dispatch (label+state → skill to read):",
						"  (no arg)               map        → chart the destination + frontier",
						"  wayfinder:map          map        → work the umbrella map",
						"  wayfinder:plan-map     plan-map   → drive the planning phase",
						"  decision/prototype/    that skill → work a planning primitive",
						"  research/task",
						"  wayfinder:spec         spec       → synthesise (or overwrite) the PRD",
						"  implementation-map     (redirect) → point at the frontier unit-map/development",
						"  unit-map               unit-map   → drive one mergeable unit",
						"  development            development → one coding round (incl. rework)",
						"  unit-review            unit-review→ review a development branch",
						"  merge                  merge      → land a unit on the trunk",
						"  implementation-review  impl-review→ review the integrated trunk",
						"",
						"Phase doctrine lives in one skill per label; this command injects only",
						"the compact overview (dispatch + meta-doctrine + taxonomy + tracker-ops)",
						"+ a one-line directive telling the agent to resolve <ref> and read its skill.",
					].join("\n"),
					"info",
				);
				return;
			}

			// The command's only TypeScript I/O: detect the tracker (today's
			// `git remote` autodetect) so the overview injects the correct
			// tracker-ops section. Ref RESOLUTION is the agent's first step.
			const tracker = await resolveTracker(ctx); // reused as-is from today
			const repo = repoSlug(ctx.cwd); // reused as-is from today
			ctx.ui.notify(`Wayfinder tracker: ${tracker}`, "info");

			// Injected body = compact overview (shared frame, incl. tracker-ops)
			// + a one-line resolution directive. The agent resolves <ref> to a
			// ticket, reads its label, applies the overview's dispatch table,
			// reads the matching skill, and acts.
			const body = [
				buildOverview({ tracker, repo }),
				"",
				"---",
				"",
				resolveDirective(ref),
			].join("\n");

			await deliverDoctrine(ctx, "wayfinder", body);
		},
	});
}

/**
 * The one-line directive appended after the overview. Tells the agent to
 * resolve `<ref>` (number / URL / description / nothing) to a ticket, read its
 * label+state, and dispatch per the overview's table.
 */
function resolveDirective(ref: string): string {
	if (!ref) {
		return "**Chart.** No reference given → grill the destination and create the map + frontier (read the `map` skill).";
	}
	return [
		`You are working \`${ref}\`.`,
		"**Resolve it first** (one step, per the tracker-ops above):",
		"- number or URL → `gh issue view <ref>` (or `glab`/local equivalent) and read its `wayfinder:<type>` label + state;",
		"- description → `gh issue list --search \"<ref>\"` (or equivalent) and pick the match; if several, ask the user to disambiguate.",
		"Then apply the dispatch table above: read the matching skill and act. (If the ref isn't a wayfinder ticket, say so and stop.)",
	].join("\n");
}

// Stubs reusing today's helpers verbatim — kept here only so the prototype file
// is self-contained; the real build imports them from `./tracker.js` / paths.
async function resolveTracker(_ctx: ExtensionCommandContext): Promise<TrackerKind> {
	return "github";
}
function repoSlug(_cwd: string): string {
	return "mypi";
}
type TrackerKind = "github" | "gitlab" | "local";
