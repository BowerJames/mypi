/**
 * render-raw extension
 *
 * Registers `/render-raw`: finds the last assistant message via the session
 * manager and appends a SEPARATE rendering of it to the chat, using a custom
 * message type so it routes through a custom renderer that emits the text
 * verbatim (plain `Text`, no `Markdown` processing). This shows the raw
 * markdown the model emitted — `**bold**` stays literal, headings keep their
 * leading `#`, code fences keep their backticks, etc.
 *
 * Why a custom message rather than re-rendering the assistant message itself:
 * pi renders every assistant text block through its built-in `Markdown`
 * component (`AssistantMessageComponent`) and exposes no extension hook to
 * swap that out or toggle a "raw" mode. Registering a renderer keyed by
 * `customType` is the only way to control how a message is rendered, and it
 * only applies to custom-typed messages — so we inject a copy.
 *
 * Additive, not a toggle: the original nicely-formatted assistant message
 * stays in place; `/render-raw` appends a raw copy below it. It cannot
 * replace or hide the original (there is no `SessionManager.removeEntry`).
 *
 * The injected custom message is excluded from the LLM context via a
 * `context` event filter — a `CustomMessageEntry` participates in context by
 * default, so this filter is REQUIRED to avoid polluting the conversation
 * with a duplicate of the assistant's reply.
 *
 * Dedupe: re-running `/render-raw` for the SAME last reply does not stack a
 * duplicate. The source text of the last rendered reply is tracked in
 * module-local state (reconstructed from the session on `session_start`), and
 * a re-run that would duplicate it instead notifies the user. After a NEW
 * assistant reply, `/render-raw` renders again.
 *
 * Command:
 *   /render-raw   — append a raw rendering of the last assistant reply
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import {
	contentToText,
	isRenderRawMessage,
	lastAssistantText,
	lastRenderedSource,
	RENDER_RAW_CUSTOM_TYPE,
	type RenderRawEntry,
} from "./last-assistant.js";

export default function renderRawExtension(pi: ExtensionAPI): void {
	/**
	 * Source text of the last assistant reply we rendered raw.
	 *
	 * Used purely for dedupe: a re-run against the same reply is a no-op.
	 * Reconstructed from the session on `session_start` so it survives
	 * `/reload`, `/resume`, and `/new`.
	 */
	let lastRendered: string | null = null;

	// --- Custom renderer: emit the text verbatim, no Markdown processing ---
	pi.registerMessageRenderer(RENDER_RAW_CUSTOM_TYPE, (message, _options, theme) => {
		const container = new Container();
		// Small label so the raw block is distinguishable from the formatted
		// reply above it. Content itself is a plain Text (literal markdown).
		container.addChild(new Text(theme.fg("dim", theme.italic("raw markdown")), 0, 0));
		container.addChild(new Text(contentToText(message.content), 0, 0));
		return container;
	});

	// --- Keep the injected custom message OUT of the LLM context ---
	pi.on("context", (event) => ({
		messages: event.messages.filter((m) => !isRenderRawMessage(m)),
	}));

	// --- Reconstruct dedupe state on session start/resume/reload ---
	pi.on("session_start", (_event, ctx) => {
		lastRendered = lastRenderedSource(ctx.sessionManager.getEntries() as RenderRawEntry[]);
	});

	// --- Command ---
	pi.registerCommand("render-raw", {
		description: "Append a raw (unformatted) rendering of the last assistant reply",
		handler: async (_args, ctx) => {
			// No scrollback to render into outside the TUI.
			if (!ctx.hasUI) return;

			const text = lastAssistantText(ctx.sessionManager.getEntries() as RenderRawEntry[]);
			if (!text) {
				ctx.ui.notify("render-raw: no assistant reply found.", "warning");
				return;
			}

			// Dedupe: never stack a second raw copy of the same reply.
			if (text === lastRendered) {
				ctx.ui.notify("render-raw: last reply is already rendered raw.", "info");
				return;
			}

			pi.sendMessage({
				customType: RENDER_RAW_CUSTOM_TYPE,
				content: text,
				display: true,
			});
			lastRendered = text;
		},
	});
}
