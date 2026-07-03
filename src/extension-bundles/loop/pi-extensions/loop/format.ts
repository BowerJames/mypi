/**
 * Pure presentation + extraction helpers for the `loop` extension.
 *
 * No pi imports and no side effects, so every function is trivially unit
 * testable. Mirrors the structure of `extensions/btw/format.ts`.
 */

import type { SessionContext } from "@earendil-works/pi-coding-agent";

/**
 * Extract the text of the final assistant message that actually has text.
 *
 * Walks backwards so a trailing tool-only assistant turn (no text) is skipped
 * in favour of the preceding turn that produced an answer. Returns "" when no
 * assistant text is present.
 *
 * This is the local the-loop equivalent of `getFinalAssistantText` in the
 * `btw` extension; kept separate so the two extensions stay decoupled.
 */
export function getFinalAssistantText(messages: SessionContext["messages"]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;
		const texts: string[] = [];
		for (const part of msg.content) {
			if (part.type === "text") texts.push(part.text);
		}
		if (texts.length > 0) return texts.join("\n");
	}
	return "";
}

/**
 * Compose the footer status text for the current iteration.
 *
 * Iteration numbering is 1-based for display ("on iteration 1 of 10").
 */
export function composeStatus(iter: number, max: number): string {
	return `🔄 loop: ${iter}/${max}`;
}

/** Format the "loop started" chat notification. */
export function formatStarted(max: number, hasRegex: boolean): string {
	const base = `max ${max} iteration${max === 1 ? "" : "s"}`;
	const term = hasRegex ? "; stops when the terminal regex matches or max is reached" : "";
	return `loop › started (${base}${term})`;
}

/** Format the per-iteration "running" chat notification. */
export function formatIteration(iter: number, max: number, preview: string): string {
	return `loop › iteration ${iter}/${max} — ${preview}`;
}

/** Format the terminal-regex-match success notification. */
export function formatTerminalMatch(iter: number): string {
	return `loop › terminal condition met on iteration ${iter} — stopping.`;
}

/** Format the max-iterations-reached notification. */
export function formatMaxIter(max: number): string {
	return `loop › reached --max-iter ${max} — stopping.`;
}

/** Format the cancelled-by-tree-navigation notification. */
export function formatCancelled(): string {
	return "loop › aborted (tree navigation was cancelled).";
}

/**
 * One-line usage summary, shown when the user invokes `/loop` with no args or
 * a parse error. Mirrors the project convention that every command surfaces
 * its usage.
 */
export function usageString(): string {
	return [
		'Usage: /loop [--terminal-regex <source>] [--max-iter <n>] --loop ["msg",...]',
		"  --loop            JSON array of messages sent in order each iteration (required)",
		"  --max-iter        Max iterations (default 10)",
		"  --terminal-regex  Regex source; a match on the iteration's final assistant text stops the loop",
	].join("\n");
}
