/**
 * Clear-then-inject — the shared "send" step for the (single) wayfinder command.
 *
 * The `/wayfinder` command turns the agent into a wayfinder for one turn by
 * injecting the always-injected overview + a one-line resolution directive.
 * To keep that doctrine the agent's entire frame — unbiased by whatever the
 * user and agent were just discussing — the conversation is cleared **first**
 * via `ctx.newSession(...)`, so the doctrine becomes the first and only
 * message of a fresh session.
 *
 * - **Busy (mid-stream):** refuse and warn the user to wait and re-run, rather
 *   than discard or preempt in-flight work.
 * - **Idle:** start a new session linked back to the current one via
 *   `parentSession` (the origin is traceable, and the prior conversation stays
 *   recoverable via `/resume`), then fire the doctrine through the fresh
 *   session's `sendMessage` with `triggerTurn: true` so it starts a turn at
 *   once as the sole message.
 *
 * The full configuration — every extension (including the wayfinder bundle),
 * the system prompt, the model, skills, and base tools — carries over
 * unchanged; only the conversation log resets.
 *
 * Extracted into its own module so the clear-vs-refuse branching can be
 * exercised against a fake `ExtensionCommandContext` in tests, rather than
 * reaching into the live `ExtensionAPI` (`pi.sendMessage`). The doctrine
 * string is built by the caller *before* invoking this (it carries cleanly
 * across the session swap).
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

/** The `customType` carried by the wayfinder overview doctrine message. */
export type WayfinderDoctrineType = "wayfinder";

/**
 * Clear the conversation, then inject `content` as the fresh session's sole
 * doctrine message. When the agent is busy, refuse (no clear, no inject) and
 * warn the user to re-run once idle. Resolves once the new session has been
 * started and the doctrine queued (or immediately, after refusing).
 */
export async function deliverDoctrine(
	ctx: ExtensionCommandContext,
	customType: WayfinderDoctrineType,
	content: string,
): Promise<void> {
	if (!ctx.isIdle()) {
		ctx.ui.notify("Agent is busy — wait for it to finish, then re-run.", "warning");
		return;
	}

	await ctx.newSession({
		// Link the fresh wayfinder session to its origin. `getSessionFile()`
		// returns undefined for in-memory / non-persisted sessions; pass
		// `parentSession` only when a path exists, so traceability is recorded
		// when available without throwing.
		parentSession: ctx.sessionManager.getSessionFile() ?? undefined,
		// The old `pi`/`ctx` is invalidated after `newSession`, so all
		// post-replacement work runs inside `withSession` against the
		// `ReplacedSessionContext` it is handed.
		withSession: async (c) => {
			await c.sendMessage({ customType, content, display: true }, { triggerTurn: true });
		},
	});
}
