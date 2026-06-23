/** Footer status key used via `ctx.ui.setStatus`. */
export const LOOP_STATUS_KEY = "loop";

/**
 * Parsed options for a `/loop` invocation.
 *
 * - `loop` is the ordered list of messages sent to the agent each iteration
 *   (always non-empty).
 * - `maxIter` is the hard cap on iterations (always a positive integer).
 * - `terminalRegex`, when present, is tested against the final assistant text
 *   of each iteration; a match terminates the loop early.
 */
export interface LoopOptions {
	loop: string[];
	maxIter: number;
	terminalRegex?: RegExp;
}

/**
 * Result of parsing `/loop` arguments. Either a fully-validated options object
 * or an error message string suitable for surfacing to the user.
 */
export type LoopParseResult = { ok: true; options: LoopOptions } | { ok: false; error: string };
