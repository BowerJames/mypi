/**
 * Pure presentation helpers for the btw extension.
 *
 * Kept side-effect-free and free of pi imports so they are trivially unit
 * testable.
 */

/**
 * Max characters of a btw result body shown in the chat notification (~50 KB).
 *
 * A generous safety net so a runaway clone cannot flood the chat scrollback
 * — the full text is always persisted to a temp file regardless (see the
 * `filePath` pointer in `formatResult`). The line cap was removed: realistic
 * answers are not line-bounded.
 */
const MAX_RESULT_CHARS = 50_000;

/** Max length of the args preview shown in status/notifications. */
const PREVIEW_MAX = 60;

/** Truncation marker appended when a result exceeds the caps. */
const TRUNCATION_MARKER = "… (truncated)";

/**
 * Guardrail wrapped around the `/btw` task text before it is sent to the
 * clone's `session.prompt(...)`.
 *
 * The clone inherits the parent's full conversation and effective system prompt
 * (which encodes the in-progress task, AGENTS.md, mode, skills, …). Without
 * framing, the clone can reasonably decide to "help finish" the main agent's
 * work rather than just answering the side task. This directive is the last
 * thing in the clone's context (appended after the seeded conversation), so it
 * dominates steering and scopes the clone to exactly the side task.
 */

/** Preamble (before the injected task text) of the btw-task guardrail. */
const BTW_TASK_GUARDRAIL_PREFIX = `<btw-task>
You are a throwaway side-task clone of the main agent. The conversation above is provided for context only.

- Do NOT continue the main agent's work or pick up where it left off.
- Complete ONLY the side task below, then stop. Do not start any follow-up work.
- Only modify files or run state-changing commands (git, installs, writes, etc.) if the side task explicitly requires it; otherwise stay read-only.
- Keep the work tightly scoped to the side task.

Side task:
`;

/** Suffix (after the injected task text) of the btw-task guardrail. */
const BTW_TASK_GUARDRAIL_SUFFIX = "\n</btw-task>";

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
 * Layout (top to bottom):
 *   1. `btw › <preview>` — the task-args label (when supplied), so parallel
 *      results can be told apart.
 *   2. `↳ <filePath>` — pointer to the full, untruncated result on disk (when
 *      supplied). This line is NEVER subject to the body cap, so the full
 *      answer is always recoverable even if the scrollback rolls or the body
 *      hits the ~50 KB safety net.
 *   3. The body — `text` trimmed, or `(no output)` when empty. Capped at
 *      `MAX_RESULT_CHARS` so a verbose answer cannot flood the chat.
 *
 * Only the body is capped; the header and pointer lines are always shown in
 * full.
 */
export function formatResult(text: string, preview?: string, filePath?: string): string {
	const trimmed = text.trim();
	const body = capResult(trimmed || "(no output)");
	const lines: string[] = [];
	if (preview) lines.push(`btw › ${preview}`);
	if (filePath) lines.push(`↳ ${filePath}`);
	const header = lines.join("\n");
	return header ? `${header}\n${body}` : `btw › ${body}`;
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
 * Wrap the `/btw` task text in a `<btw-task>` guardrail before sending it to
 * the clone, so the clone treats the parent conversation as context-only,
 * completes only the side task, and stops — rather than continuing the main
 * agent's work.
 *
 * Wrapping is model-facing only: the TUI preview / status / error paths keep
 * using the raw (cleaned) task text via `previewArgs`. Trims the injected args
 * defensively (the handler already trims, but the function is self-contained).
 *
 * The task text is inserted via a template substitution rather than a string
 * `replace`, so `$`-sequences in the task text are passed through verbatim
 * (never interpreted as replacement patterns).
 */
export function wrapBtwPrompt(args: string): string {
	return `${BTW_TASK_GUARDRAIL_PREFIX}${args.trim()}${BTW_TASK_GUARDRAIL_SUFFIX}`;
}

/**
 * Enforce the character cap (~50 KB), appending a truncation marker if cut.
 */
function capResult(text: string): string {
	if (text.length <= MAX_RESULT_CHARS) return text;
	return `${text.slice(0, MAX_RESULT_CHARS)}\n${TRUNCATION_MARKER}`;
}
