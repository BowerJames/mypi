/**
 * Wayfinder Extension — the single unified command.
 *
 * Turns the agent into a **wayfinder**: chart a large, foggy effort as a
 * **map of tickets** on the repo's issue tracker and resolve them one at a
 * time until the way to the destination is clear. Inspired by
 * [mattpocock/skills `wayfinder`][src], adapted to pi/mypi.
 *
 * **One command.** `/wayfinder <ref>` — where `<ref>` is an issue number, a
 * full URL, a *description* (resolved via search), or nothing (chart). The
 * command's only TypeScript work is:
 *
 * 1. **detect the tracker** (reusing today's `git remote` autodetect + optional
 *    `.mypi/wayfinder-tracker.sh` override), so the overview injects the right
 *    tracker-ops section;
 * 2. **clear the conversation**; then
 * 3. **inject** the always-injected overview (`buildOverview`) + a one-line
 *    resolution directive.
 *
 * Ref-**resolution is the agent's first turn**, not the command's: only the
 * agent can resolve all four ref forms (a *description* needs
 * `gh issue list --search`, an LLM judgement, not a static TypeScript lookup).
 * So the command never reads the issue; it injects the overview + a directive
 * telling the agent to resolve `<ref>`, read its `wayfinder:<type>` label +
 * state, apply the dispatch table, read the matching skill, and act. `/to-spec`
 * and `/implement` are deleted; their work is absorbed (a `spec` ref → the
 * `spec` skill; an implementation ref → its skill).
 *
 * `--help` / `-h` carries the dispatch table (the replacement for the deleted
 * surfaces), satisfying the repo's AGENTS.md "every route needs a `--help`".
 *
 * The injection routes through the existing **`deliverDoctrine`** deep module
 * (unchanged clear-then-inject helper: busy → refuse-and-warn, idle →
 * `ctx.newSession` linked via `parentSession` then `sendMessage` with
 * `triggerTurn`). There is no persisted session state, no per-turn system-prompt
 * suffix, and no footer. The tracker is environment-derived (autodetected from
 * the `origin` remote, with a `cwd/.mypi/wayfinder-tracker.sh` override) and
 * memoised per session.
 *
 * [src]: https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { deliverDoctrine } from "./deliver.js";
import { buildOverview } from "./overview.js";
import { repoSlug, trackerScriptPath } from "./paths.js";
import { detectTracker, type TrackerEnv, type TrackerKind } from "./tracker.js";

/**
 * Build the production `TrackerEnv` against `ctx` + the pi exec API.
 *
 * - `scriptExists`: sync `existsSync` on `cwd/.mypi/wayfinder-tracker.sh`.
 * - `runScript`: `bash <script>` in `cwd`; stdout on success, `undefined` on
 *   non-zero exit (falls through to autodetection).
 * - `remoteUrl`: `git remote get-url origin` in `cwd`; trimmed stdout on
 *   success, `undefined` on non-zero / thrown exec (no remote → local).
 */
function productionEnv(pi: ExtensionAPI, ctx: ExtensionContext): TrackerEnv {
	const scriptPath = trackerScriptPath(ctx.cwd);
	return {
		scriptExists: () => existsSync(scriptPath),
		runScript: async () => {
			const { code, stdout } = await pi.exec("bash", [scriptPath], { cwd: ctx.cwd });
			return code === 0 ? stdout : undefined;
		},
		remoteUrl: async () => {
			const { code, stdout } = await pi.exec("git", ["remote", "get-url", "origin"], {
				cwd: ctx.cwd,
				timeout: 5000,
			});
			return code === 0 ? stdout.trim() : undefined;
		},
	};
}

export default function wayfinderExtension(pi: ExtensionAPI): void {
	// Memoised per session: the tracker is environment-derived (not user-set),
	// so it is computed once on first command use and cached for the session.
	let cached: TrackerKind | undefined;

	async function resolveTracker(ctx: ExtensionContext): Promise<TrackerKind> {
		if (cached) return cached;
		cached = await detectTracker(productionEnv(pi, ctx));
		return cached;
	}

	pi.registerCommand("wayfinder", {
		description:
			"Unified wayfinder: chart (/wayfinder) or work a ticket/map by label+state (/wayfinder <ref>)",
		handler: async (args, ctx) => {
			const ref = args.trim();

			// `--help` / `-h` carries the dispatch table — the replacement for the
			// deleted `/to-spec` / `/implement` surfaces (AGENTS.md: every route
			// needs a --help). Tracker-agnostic (the table is label+state → skill),
			// so it short-circuits before the tracker is detected and the
			// conversation is cleared.
			if (ref === "--help" || ref === "-h") {
				ctx.ui.notify(helpText(), "info");
				return;
			}

			// The command's only TypeScript I/O: detect the tracker (today's
			// `git remote` autodetect) BEFORE the inject, so the overview carries
			// the correct tracker-ops section. Ref RESOLUTION is the agent's first
			// turn, not the command's.
			const tracker = await resolveTracker(ctx);
			const repo = repoSlug(ctx.cwd);

			ctx.ui.notify(`Wayfinder tracker: ${tracker}`, "info");

			// Injected body = the always-injected overview (shared frame, incl.
			// tracker-ops) + a one-line resolution directive. `deliverDoctrine`
			// centralises the clear-then-inject: it refuses while busy, else starts
			// a new session (linked to this one via `parentSession`) and fires the
			// overview as the sole message with `triggerTurn`.
			const body = [buildOverview({ tracker, repo }), "", "---", "", resolveDirective(ref)].join(
				"\n",
			);

			await deliverDoctrine(ctx, "wayfinder", body);
		},
	});
}

/**
 * The `--help` text — the dispatch table, the four ref forms, and a pointer to
 * the skills. Tracker-agnostic (the table is label + state → skill), so it is
 * emitted without detecting the tracker or clearing the conversation.
 */
function helpText(): string {
	return [
		"Usage: /wayfinder [<ref>]   — chart (no arg) or work a ticket/map",
		"",
		"<ref> may be: an issue number, a full issue URL, a description (resolved",
		"via search), or omitted (chart a new map). Resolution is the agent's first",
		"turn — the command injects only the overview + a one-line directive.",
		"",
		"Dispatch (label + state → skill to read):",
		"  (no arg)              map                 → chart the destination + frontier",
		"  wayfinder:map         map                 → work the umbrella map",
		"  wayfinder:plan-map    plan-map            → drive the planning phase",
		"  decision/prototype/   that skill          → work a planning primitive",
		"  research/task",
		"  wayfinder:spec        spec                → synthesise (open) / implement-kickoff (closed)",
		"  implementation-map    (redirect)          → point at the frontier unit-map/development",
		"  unit-map              unit-map            → drive one mergeable unit",
		"  development           development         → one coding round (incl. rework)",
		"  unit-review           unit-review         → review a development branch",
		"  merge                 merge               → land a unit on the trunk",
		"  implementation-review implementation-review → review the integrated trunk",
		"",
		"Phase doctrine lives in one skill per label; this command injects only the",
		"compact overview (dispatch + meta-doctrine + taxonomy + tracker-ops) + a",
		"one-line directive telling the agent to resolve <ref> and read its skill.",
		"",
		"Refuses while the agent is busy (re-run once idle).",
	].join("\n");
}

/**
 * The one-line directive appended after the overview. Tells the agent to
 * resolve `<ref>` (number / URL / description / nothing) to a ticket, read its
 * `wayfinder:<type>` label + state, and dispatch per the overview's table.
 */
function resolveDirective(ref: string): string {
	if (!ref) {
		return "**Chart.** No reference given → grill the destination and create the `map` + frontier tickets (read the `map` skill).";
	}
	return [
		`You are working \`${ref}\`.`,
		"**Resolve it first** (one step, per the tracker operations above):",
		"- number or URL → `gh issue view <ref>` (or the `glab` / local equivalent) and read its `wayfinder:<type>` label + state;",
		'- description → `gh issue list --search "<ref>"` (or equivalent) and pick the match; if several, ask the user **one** question to disambiguate.',
		"Then apply the dispatch table above: read the matching skill and act. (If the ref isn't a wayfinder ticket, say so and stop.)",
	].join("\n");
}
