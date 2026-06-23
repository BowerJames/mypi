/**
 * loop extension
 *
 * Registers `/loop [...flags]`: repeats a sequence of messages to the agent
 * until a terminal condition is met, resetting the conversation back to the
 * point where the command was invoked between iterations so each pass is a
 * clean slate (not a continuous flow within a single session).
 *
 * Per iteration:
 *   1. Send each `--loop` item in order via `pi.sendUserMessage(item)`,
 *      awaiting `ctx.waitForIdle()` between items so they flow sequentially.
 *   2. Read the iteration's final assistant text.
 *   3. If `--terminal-regex` matches it, stop (success).
 *   4. Else if not the last iteration, navigate the session tree back to the
 *      anchor (captured at command start) so the next iteration starts clean.
 *
 * Reset uses `ctx.navigateTree(anchorId, { summarize: false })` rather than
 * `ctx.fork(...)`: it stays in one session file, does not emit
 * `session_shutdown`, and so keeps `ctx`/`pi` valid across the whole loop — a
 * plain `for` loop with no recursion and no stale-context footgun.
 *
 * Footer status `🔄 loop: N/M` is shown while running; start, per-iteration,
 * and terminal notifications are surfaced via `ctx.ui.notify`.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildSessionContext } from "@earendil-works/pi-coding-agent";
import {
	composeStatus,
	formatCancelled,
	formatIteration,
	formatMaxIter,
	formatStarted,
	formatTerminalMatch,
	getFinalAssistantText,
	usageString,
} from "./format.js";
import { parseLoopArgs } from "./parse.js";
import { LOOP_STATUS_KEY } from "./types.js";

/** Collapse a loop item to a short one-line preview for notifications. */
function previewItem(item: string, max = 60): string {
	const single = item.replace(/\s+/g, " ").trim();
	return single.length > max ? `${single.slice(0, max)}…` : single;
}

export default function loopExtension(pi: ExtensionAPI): void {
	pi.registerCommand("loop", {
		description:
			"Repeat messages until a terminal condition (resets to the original point each iteration)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;

			const parsed = parseLoopArgs(args);
			if (!parsed.ok) {
				ctx.ui.notify(`loop: ${parsed.error}\n${usageString()}`, "warning");
				return;
			}

			const { loop, maxIter, terminalRegex } = parsed.options;

			// Capture the anchor while idle at command start. Entry IDs are stable
			// across tree navigation, so this is reusable on every iteration.
			const anchorId = ctx.sessionManager.getLeafId();
			if (!anchorId) {
				ctx.ui.notify("loop: no current session point to anchor from.", "error");
				return;
			}

			ctx.ui.setStatus(LOOP_STATUS_KEY, composeStatus(1, maxIter));
			ctx.ui.notify(formatStarted(maxIter, terminalRegex !== undefined), "info");

			// try/finally guarantees the footer status is cleared on every exit path
			// (terminal match, cancelled navigation, max-iter reached, or an
			// unexpected throw from sendUserMessage/waitForIdle/navigateTree).
			try {
				for (let iter = 1; iter <= maxIter; iter++) {
					ctx.ui.setStatus(LOOP_STATUS_KEY, composeStatus(iter, maxIter));
					ctx.ui.notify(formatIteration(iter, maxIter, previewItem(loop[0])), "info");

					// Send each loop item in order, waiting for the agent to settle so
					// later items see earlier items' output within the iteration.
					for (const item of loop) {
						pi.sendUserMessage(item);
						await ctx.waitForIdle();
					}

					// Evaluate the terminal condition against this iteration's final
					// assistant text. The standalone buildSessionContext accepts the
					// read-only session view + leaf id (no cast needed).
					const finalText = getFinalAssistantText(
						buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId())
							.messages,
					);

					if (terminalRegex?.test(finalText)) {
						ctx.ui.notify(formatTerminalMatch(iter), "info");
						return;
					}

					// Reset to the anchor for a clean slate next iteration, unless this
					// was the last one. summarize:false suppresses the branch-summary
					// prompt; each iteration becomes a sibling branch off the anchor.
					if (iter < maxIter) {
						const result = await ctx.navigateTree(anchorId, { summarize: false });
						if (result.cancelled) {
							ctx.ui.notify(formatCancelled(), "warning");
							return;
						}
						await ctx.waitForIdle();
					}
				}

				ctx.ui.notify(formatMaxIter(maxIter), "info");
			} finally {
				ctx.ui.setStatus(LOOP_STATUS_KEY, undefined);
			}
		},
	});
}
