/**
 * loop extension
 *
 * Registers `/loop [...flags]`: repeats a sequence of messages to the agent
 * until a terminal condition is met, resetting the conversation back to the
 * point where the command was invoked after EVERY item so each item runs from
 * a clean slate (items within an iteration are independent — item N does NOT
 * see item N-1's output).
 *
 * Per iteration (a "pass" over the --loop array):
 *   1. Send each `--loop` item in order via `pi.sendUserMessage(item)`,
 *      waiting for the turn to start (`agent_start` event) and then
 *      waiting for the agent to go idle. After EACH item the session is
 *      reset back to the anchor, so items are independent rather than a
 *      sequential build-up.
 *   2. Read the LAST item's final assistant text (captured before its reset).
 *   3. If `--terminal-regex` matches it, stop (success).
 *   4. The last item's reset also serves as the between-iteration reset, so
 *      the next iteration starts from the anchor.
 *
 * The session always ends at the anchor on every non-cancelled exit path
 * (terminal match, max-iter reached): the last item's reset has already run
 * when the loop returns. The sole exception is an explicit user cancellation
 * of the tree navigation, where the reset cannot proceed.
 *
 * Reset uses `ctx.navigateTree(anchorId, { summarize: false })` rather than
 * `ctx.fork(...)`: it stays in one session file, does not emit
 * `session_shutdown`, and so keeps `ctx`/`pi` valid across the whole loop — a
 * plain `for` loop with no recursion and no stale-context footgun.
 *
 * Footer status `🔄 loop: N/M` is shown while running; start, per-iteration,
 * and terminal notifications are surfaced via `ctx.ui.notify`.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
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

/**
 * Send a user message and wait for the turn to start and complete.
 *
 * `pi.sendUserMessage` is fire-and-forget (detached promise, returns void).
 * We need to synchronise on two milestones before sending the next item:
 *
 *   1. The turn has actually started — so that `waitForIdle()` (which
 *      returns `activeRun?.promise ?? Promise.resolve()`) returns a real
 *      promise instead of resolving instantly.
 *   2. The turn has completed — via `waitForIdle()`.
 *
 * For (1) we listen for `agent_start`, NOT `before_agent_start`.
 * `before_agent_start` fires inside `emitBeforeAgentStart()`, which is
 * `await`ed by `prompt()`. Resolving our promise there schedules a
 * microtask that runs BEFORE `prompt()` continues to `_runAgentPrompt` →
 * `runWithLifecycle` (which is where `activeRun` is set). At that point
 * `waitForIdle()` sees no `activeRun` and returns `Promise.resolve()` —
 * resolving spuriously and letting the next `sendUserMessage` collide
 * with the still-pending turn ("Agent is already processing").
 *
 * `agent_start`, by contrast, fires inside `runWithLifecycle`'s executor —
 * AFTER `activeRun` and `isStreaming` are set — so when we resume and call
 * `waitForIdle()`, a real `activeRun.promise` is returned.
 *
 * Each call creates a new Promise and writes its resolver into
 * `resolveTurnStart`. The `agent_start` handler calls the resolver when
 * the event fires. After each call, `resolveTurnStart[0]` holds a stale
 * (already-resolved) resolver — calling it is a no-op, so the handler
 * does nothing between items or across /loop invocations.
 */
async function sendAndWaitForTurn(
	ctx: ExtensionCommandContext,
	pi: ExtensionAPI,
	item: string,
	resolveTurnStart: [(() => void) | undefined],
): Promise<void> {
	const start = new Promise<void>((resolve) => {
		resolveTurnStart[0] = resolve;
	});
	pi.sendUserMessage(item);
	await start;
	await ctx.waitForIdle();
}

/**
 * Navigate the session tree back to the anchor for a clean slate.
 *
 * `summarize:false` suppresses the branch-summary prompt, so each item /
 * iteration becomes a sibling branch off the anchor. Returns `false` when the
 * user cancelled the navigation, signalling the caller to abort the loop.
 */
async function resetToAnchor(ctx: ExtensionCommandContext, anchorId: string): Promise<boolean> {
	const result = await ctx.navigateTree(anchorId, { summarize: false });
	if (result.cancelled) {
		ctx.ui.notify(formatCancelled(), "warning");
		return false;
	}
	await ctx.waitForIdle();
	return true;
}

/** Collapse a loop item to a short one-line preview for notifications. */
function previewItem(item: string, max = 60): string {
	const single = item.replace(/\s+/g, " ").trim();
	return single.length > max ? `${single.slice(0, max)}…` : single;
}

export default function loopExtension(pi: ExtensionAPI): void {
	// Mutable resolver reference for the agent_start handler.
	// Registered once at extension level (not inside the command handler)
	// so it never accumulates across /loop invocations.
	// After each item, it holds a stale (already-resolved) resolver;
	// calling it is a no-op, so the handler is harmless between items.
	const resolveTurnStart: [(() => void) | undefined] = [undefined];

	pi.on("agent_start", () => {
		resolveTurnStart[0]?.();
	});

	pi.registerCommand("loop", {
		description:
			"Repeat messages until a terminal condition (resets to the original point after every item; the session ends back at the anchor)",
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

					// Every item runs from a clean anchor: reset after EACH item
					// (including the last), so items are independent — item N does
					// NOT see item N-1's output. The last item's reset also serves
					// as the between-iteration reset and guarantees the session
					// ends at the anchor on every non-cancelled exit path.
					let finalText = "";
					for (let idx = 0; idx < loop.length; idx++) {
						await sendAndWaitForTurn(ctx, pi, loop[idx], resolveTurnStart);

						// Capture the last item's response BEFORE resetting it away.
						if (idx === loop.length - 1) {
							finalText = getFinalAssistantText(
								buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId())
									.messages,
							);
						}

						if (!(await resetToAnchor(ctx, anchorId))) return; // cancelled
					}

					// Terminal condition: checked once per iteration against the
					// LAST item's response. The session is already back at the
					// anchor (last item's reset above), so we just return.
					if (terminalRegex?.test(finalText)) {
						ctx.ui.notify(formatTerminalMatch(iter), "info");
						return;
					}
				}

				ctx.ui.notify(formatMaxIter(maxIter), "info");
				// Session already at anchor (last item's reset ran above).
			} finally {
				ctx.ui.setStatus(LOOP_STATUS_KEY, undefined);
			}
		},
	});
}
