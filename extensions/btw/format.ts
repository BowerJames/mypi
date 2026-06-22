/**
 * Pure presentation helpers for the btw extension.
 *
 * Kept side-effect-free and free of pi imports so they are trivially unit
 * testable.
 */

/** Max lines / characters of a btw result shown in the chat notification. */
const MAX_RESULT_LINES = 25;
const MAX_RESULT_CHARS = 2000;

/** Max length of the args preview shown in status/notifications. */
const PREVIEW_MAX = 60;

/** Truncation marker appended when a result exceeds the caps. */
const TRUNCATION_MARKER = "… (truncated)";

type BtwTaskStatus = "running" | "done" | "error";

/**
 * Collapse whitespace and cap a task's args to a short preview.
 */
export function previewArgs(args: string, max = PREVIEW_MAX): string {
	const single = args.replace(/\s+/g, " ").trim();
	return single.length > max ? `${single.slice(0, max)}…` : single;
}

/**
 * Compose the footer status text for the current set of tasks.
 *
 * Returns `undefined` (which clears the status slot via `setStatus`) when
 * nothing is running, so the footer only shows activity while clones are live.
 */
export function composeStatus(tasks: { status: BtwTaskStatus }[]): string | undefined {
	const running = tasks.filter((t) => t.status === "running").length;
	return running > 0 ? `⚙ btw: ${running} running` : undefined;
}

/**
 * Format a clone's final assistant text for display as a chat notification.
 *
 * When a `preview` (the task's args, already collapsed/capped by `previewArgs`)
 * is supplied, it is shown on the first line so parallel results can be told
 * apart; the answer follows on subsequent lines. Collapses to `(no output)`
 * when empty, and caps length so a verbose answer does not flood the chat
 * scrollback.
 */
export function formatResult(text: string, preview?: string): string {
	const trimmed = text.trim();
	const body = trimmed || "(no output)";
	if (preview) return capResult(`btw › ${preview}\n${body}`);
	return capResult(`btw › ${body}`);
}

/**
 * Format the "task started" chat notification.
 *
 * Confirms which task launched — useful when several run in parallel. This
 * uses the info/status path which coalesces consecutive status lines, so in the
 * idle case it may be overwritten by the later result line; the footer's
 * `⚙ btw: N running` indicator always reflects running state regardless.
 */
export function formatStarted(preview: string): string {
	return `btw › started: ${preview}`;
}

/**
 * Format an error notification, tying it to the task preview when available so
 * parallel failures can be disambiguated.
 */
export function formatError(message: string, preview?: string): string {
	return preview ? `btw: failed (${preview}) — ${message}` : `btw: failed — ${message}`;
}

/**
 * Enforce the line/character caps, appending a truncation marker if cut.
 */
function capResult(text: string): string {
	let truncated = false;

	const lines = text.split("\n");
	let joined: string;
	if (lines.length > MAX_RESULT_LINES) {
		joined = lines.slice(0, MAX_RESULT_LINES).join("\n");
		truncated = true;
	} else {
		joined = text;
	}

	if (joined.length > MAX_RESULT_CHARS) {
		joined = joined.slice(0, MAX_RESULT_CHARS);
		truncated = true;
	}

	return truncated ? `${joined}\n${TRUNCATION_MARKER}` : joined;
}
