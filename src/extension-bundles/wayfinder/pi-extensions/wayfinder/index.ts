/**
 * Wayfinder Extension
 *
 * Turns the agent into a **wayfinder**: chart a large, foggy effort (too big
 * for one session) as a **map of decision tickets** on the repo's issue
 * tracker, and resolve them one at a time until the way to the destination is
 * clear. Inspired by [mattpocock/skills `wayfinder`][src], adapted to pi/mypi.
 *
 * The agent does all tracker I/O with its built-in tools (`bash` → `gh` /
 * `glab` / file writes); this extension supplies only the operating doctrine,
 * composed with the correct tracker operations for the detected tracker.
 *
 * Commands:
 *   /wayfinder              — grill the destination, then create the map and
 *                             the primitive tickets for the frontier.
 *   /wayfinder <ticket-ref> — point this session at a ticket; the model
 *                             auto-detects its primitive type and acts.
 *
 * Both commands are one-shot doctrine injectors (`pi.sendMessage`) — there is
 * no persisted session state, no per-turn system-prompt suffix, and no footer.
 * The tracker is environment-derived (autodetected from the `origin` remote,
 * with a `cwd/.mypi/wayfinder-tracker.sh` override) and memoised per session.
 *
 * [src]: https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { repoSlug, trackerScriptPath } from "./paths.js";
import { buildChartDoctrine, buildTicketDoctrine } from "./prompt.js";
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
		description: "Chart a wayfinder map (/wayfinder) or work a ticket (/wayfinder <ticket-ref>)",
		handler: async (args, ctx) => {
			const tracker = await resolveTracker(ctx);
			const repo = repoSlug(ctx.cwd);
			const ticketRef = args.trim();

			ctx.ui.notify(`Wayfinder tracker: ${tracker}`, "info");

			// Each command path emits exactly one doctrine message, so both carry
			// the turn trigger (the "final message only" carry-forward rule). When
			// idle, `triggerTurn` starts the agent on the doctrine; when already
			// streaming, the doctrine is parked as `nextTurn` context and injected
			// at the start of the next user-initiated turn — never a mid-flight
			// `steer` of an unrelated turn, nor `followUp` (which would auto-fire
			// with no input).
			const idle = ctx.isIdle();

			if (ticketRef) {
				pi.sendMessage(
					{
						customType: "wayfinder-ticket",
						content: buildTicketDoctrine({ tracker, repo, ticketRef }),
						display: true,
					},
					{ triggerTurn: idle, deliverAs: idle ? undefined : "nextTurn" },
				);
			} else {
				pi.sendMessage(
					{
						customType: "wayfinder-chart",
						content: buildChartDoctrine({ tracker, repo }),
						display: true,
					},
					{ triggerTurn: idle, deliverAs: idle ? undefined : "nextTurn" },
				);
			}
		},
	});
}
