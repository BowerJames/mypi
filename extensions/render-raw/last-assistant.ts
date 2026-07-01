/**
 * Pure helpers for the render-raw extension.
 *
 * All functions operate over a minimal, permissive view of a session entry
 * (`RenderRawEntry`) so they can be unit-tested without importing the full
 * (private) pi entry / AgentMessage union. Call sites pass the real entries
 * from `ctx.sessionManager.getEntries()`, which are structurally assignable.
 */

/** Custom message type used by the render-raw extension. */
export const RENDER_RAW_CUSTOM_TYPE = "render-raw";

/**
 * Minimal view of a session entry sufficient for these helpers.
 *
 * Every field is optional because session entries are a heterogeneous
 * discriminated union: only `message` entries carry `message`, only
 * `custom_message` entries carry `content` + `customType`, etc.
 */
export type RenderRawEntry = {
	type?: string;
	customType?: string;
	content?: unknown;
	message?: { role?: string; content?: unknown };
};

/**
 * Extract text from a message content payload.
 *
 * - A string content is returned verbatim.
 * - An array is reduced to its `text` blocks joined by newlines. Thinking and
 *   tool-call blocks are ignored, matching how the assistant message is
 *   rendered (only `text` blocks carry the markdown the model emitted).
 * - Anything else yields an empty string.
 */
export function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: "text"; text: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string",
		)
		.map((block) => block.text)
		.join("\n");
}

/**
 * Find the trimmed text of the last `role === "assistant"` message entry.
 *
 * Walks the array from the end so it reflects the most recent assistant reply.
 * Returns `null` when there is no assistant message, or the last one has no
 * non-whitespace text (e.g. it was tool-call-only).
 */
export function lastAssistantText(entries: readonly RenderRawEntry[]): string | null {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type === "message" && entry.message?.role === "assistant") {
			const text = contentToText(entry.message?.content).trim();
			return text.length > 0 ? text : null;
		}
	}
	return null;
}

/**
 * Reconstruct the source text that was last rendered raw.
 *
 * Returns the content of the most recent `custom_message` entry with our
 * `customType`, or `null` if none exists. Because `/render-raw` copies the
 * assistant text verbatim into the custom message content, this is exactly
 * the value the dedupe guard should compare against.
 */
export function lastRenderedSource(entries: readonly RenderRawEntry[]): string | null {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (
			entry?.type === "custom_message" &&
			entry.customType === RENDER_RAW_CUSTOM_TYPE &&
			typeof entry.content === "string"
		) {
			return entry.content;
		}
	}
	return null;
}

/**
 * Type guard shared by the `context` event filter. Returns true for custom
 * messages injected by this extension (which must be stripped from the LLM
 * context). Accepts a permissive shape so it can be applied to any
 * `AgentMessage` without importing the union.
 */
export function isRenderRawMessage(message: { role?: string; customType?: string }): boolean {
	return message.role === "custom" && message.customType === RENDER_RAW_CUSTOM_TYPE;
}
